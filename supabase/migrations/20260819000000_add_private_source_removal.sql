-- Source removal is a recoverable, request-driven state transition. Marking a
-- Source as deleting immediately removes it from Retrieval before Storage and
-- database cleanup run in sequence.

alter table public.sources
  drop constraint sources_processing_stage,
  add constraint sources_processing_stage check (
    processing_stage in (
      'uploaded',
      'extracting',
      'chunking',
      'embedding',
      'ready',
      'failed',
      'deleting'
    )
  );

create or replace function public.begin_private_source_deletion(
  target_guest_id uuid,
  target_source_id uuid
)
returns table (source_id uuid, notebook_id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_notebook_id uuid;
  current_storage_path text;
begin
  if target_guest_id is null or target_source_id is null then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  select sources.notebook_id
  into current_notebook_id
  from public.sources
  join public.notebooks on notebooks.id = sources.notebook_id
  where sources.id = target_source_id
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example;

  if not found then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('sources:' || current_notebook_id::text)
  );

  select sources.notebook_id, sources.storage_path
  into current_notebook_id, current_storage_path
  from public.sources
  join public.notebooks on notebooks.id = sources.notebook_id
  where sources.id = target_source_id
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example
  for update of sources;

  if not found then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  update public.sources
  set
    processing_stage = 'deleting',
    failure_category = null,
    retry_stage = null,
    correlation_id = null
  where id = target_source_id;

  delete from public.ingestion_leases
  where ingestion_leases.source_id = target_source_id;

  return query select
    target_source_id,
    current_notebook_id,
    current_storage_path;
end;
$$;

create or replace function public.complete_private_source_deletion(
  target_guest_id uuid,
  target_source_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_notebook_id uuid;
  deleted_source_id uuid;
begin
  select sources.notebook_id
  into current_notebook_id
  from public.sources
  join public.notebooks on notebooks.id = sources.notebook_id
  where sources.id = target_source_id
    and sources.processing_stage = 'deleting'
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example;

  if not found then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('sources:' || current_notebook_id::text)
  );

  select sources.notebook_id
  into current_notebook_id
  from public.sources
  join public.notebooks on notebooks.id = sources.notebook_id
  where sources.id = target_source_id
    and sources.processing_stage = 'deleting'
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example
  for update of sources;

  if not found then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  delete from public.sources
  where sources.id = target_source_id
    and sources.processing_stage = 'deleting'
  returning sources.id into deleted_source_id;

  if deleted_source_id is null then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  return true;
end;
$$;

-- Notebook deletion receives the exact Source set whose Storage objects were
-- removed. If that set changed concurrently, keep the Notebook for a safe,
-- idempotent retry instead of cascading a newly uploaded PDF into an orphan.
create or replace function public.delete_private_notebook(
  target_guest_id uuid,
  target_notebook_id uuid,
  expected_source_ids uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_source_ids uuid[];
  normalized_expected_source_ids uuid[];
begin
  if target_guest_id is null
    or target_notebook_id is null
    or expected_source_ids is null
  then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  select coalesce(array_agg(source_id order by source_id), array[]::uuid[])
  into normalized_expected_source_ids
  from (
    select distinct expected.source_id
    from unnest(expected_source_ids) as expected(source_id)
  ) as normalized(source_id);

  if cardinality(expected_source_ids)
    <> cardinality(normalized_expected_source_ids)
  then
    raise exception using errcode = '22023', message = 'invalid_source_set';
  end if;

  perform 1
  from public.notebooks
  where notebooks.id = target_notebook_id
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example;

  if not found then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('sources:' || target_notebook_id::text)
  );

  perform 1
  from public.notebooks
  where notebooks.id = target_notebook_id
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example
  for update;

  if not found then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  select coalesce(array_agg(sources.id order by sources.id), array[]::uuid[])
  into current_source_ids
  from public.sources
  where sources.notebook_id = target_notebook_id;

  if current_source_ids <> normalized_expected_source_ids then
    raise exception using errcode = 'P0001', message = 'notebook_sources_changed';
  end if;

  delete from public.notebooks
  where notebooks.id = target_notebook_id;

  return true;
end;
$$;

-- A Citation cannot be completed against a Source whose removal has begun.
-- The row lock gives Answer completion and Source deletion a clear ordering.
create or replace function public.ensure_citation_source_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.passage_id is null then
    return new;
  end if;

  perform 1
  from public.passages
  join public.sources on sources.id = passages.source_id
  where passages.id = new.passage_id
    and sources.processing_stage = 'ready'
  for share of sources;

  if not found then
    raise exception using errcode = '22023', message = 'citation_unavailable';
  end if;

  return new;
end;
$$;

create trigger citations_require_ready_source
before insert on public.citations
for each row execute function public.ensure_citation_source_ready();

create or replace function public.acquire_ingestion_lease(
  target_guest_id uuid,
  target_source_id uuid,
  request_correlation_id uuid,
  concurrent_limit integer
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if concurrent_limit < 1 then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  perform 1
  from public.sources
  join public.notebooks on notebooks.id = sources.notebook_id
  where sources.id = target_source_id
    and sources.processing_stage <> 'deleting'
    and notebooks.owner_id = target_guest_id
    and not notebooks.is_example
  for share of sources;

  if not found then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_guest_id::text));
  delete from public.ingestion_leases
  where expires_at < timezone('utc', now());

  if (
    select count(*) >= concurrent_limit
    from public.ingestion_leases
    where guest_id = target_guest_id
  ) then
    raise exception using errcode = 'P0001', message = 'ingestion_limit_reached';
  end if;

  insert into public.ingestion_leases (source_id, guest_id, correlation_id)
  values (target_source_id, target_guest_id, request_correlation_id);
end;
$$;

revoke all on function public.begin_private_source_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_private_source_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_private_notebook(uuid, uuid, uuid[])
  from public, anon, authenticated;
revoke all on function public.ensure_citation_source_ready()
  from public, anon, authenticated;
revoke all on function public.acquire_ingestion_lease(uuid, uuid, uuid, integer)
  from public, anon, authenticated;

grant execute on function public.begin_private_source_deletion(uuid, uuid)
  to service_role;
grant execute on function public.complete_private_source_deletion(uuid, uuid)
  to service_role;
grant execute on function public.delete_private_notebook(uuid, uuid, uuid[])
  to service_role;
grant execute on function public.acquire_ingestion_lease(uuid, uuid, uuid, integer)
  to service_role;

-- Ingestion runs only after its ownership-checked lease is acquired, but its
-- persistence adapter still needs these narrow row privileges. Keeping Source
-- DELETE out of this grant ensures removal stays behind the functions above.
grant select, update on table public.sources to service_role;
grant select, insert, update, delete on table public.passages to service_role;
