-- Runtime-configurable provider quotas and ingestion leases. These functions are
-- service-role only: the application authenticates the Guest, then the database
-- atomically rechecks ownership before privileged work begins.

create table public.model_usage (
  id bigint generated always as identity primary key,
  guest_id uuid not null references auth.users (id) on delete cascade,
  answer_message_id uuid not null unique references public.messages (id) on delete cascade,
  provider text not null,
  model text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index model_usage_guest_day_idx on public.model_usage (guest_id, created_at);
alter table public.model_usage enable row level security;
alter table public.model_usage force row level security;
revoke all on table public.model_usage from public, anon, authenticated;

create policy "Guests read their model usage"
on public.model_usage for select to authenticated
using ((select auth.uid()) = guest_id);
grant select on table public.model_usage to authenticated;

create table public.ingestion_leases (
  source_id uuid primary key references public.sources (id) on delete cascade,
  guest_id uuid not null references auth.users (id) on delete cascade,
  correlation_id uuid not null,
  acquired_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '2 minutes'
);

create index ingestion_leases_guest_idx on public.ingestion_leases (guest_id);
alter table public.ingestion_leases enable row level security;
alter table public.ingestion_leases force row level security;
revoke all on table public.ingestion_leases from public, anon, authenticated;

create or replace function public.assert_question_budget(
  target_guest_id uuid,
  guest_daily_limit integer,
  deployment_hard_ceiling bigint
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_guest_id is null or guest_daily_limit < 1 or deployment_hard_ceiling < 0 then
    raise exception using errcode = '22023', message = 'invalid_question_budget';
  end if;

  perform pg_advisory_xact_lock(hashtext('question-budget'));

  if (
    select
      (select count(*) from public.model_usage
       where guest_id = target_guest_id
         and created_at >= date_trunc('day', timezone('utc', now())) at time zone 'utc')
      +
      (select count(*) from public.messages answers
       join public.conversations on conversations.id = answers.conversation_id
       where conversations.owner_id = target_guest_id
         and answers.role = 'answer' and answers.status = 'pending'
         and answers.created_at >= date_trunc('day', timezone('utc', now())) at time zone 'utc')
      >= guest_daily_limit
  ) then
    raise exception using errcode = 'P0001', message = 'question_limit_reached';
  end if;

  if deployment_hard_ceiling = 0 or (
    select
      (select count(*) from public.model_usage)
      + (select count(*) from public.messages where role = 'answer' and status = 'pending')
      >= deployment_hard_ceiling
  ) then
    raise exception using errcode = 'P0001', message = 'deployment_question_budget_reached';
  end if;
end;
$$;

create or replace function public.begin_budgeted_grounded_question(
  target_guest_id uuid,
  target_notebook_id uuid,
  question_content text,
  request_correlation_id uuid,
  guest_daily_limit integer,
  deployment_hard_ceiling bigint
)
returns table (conversation_id uuid, question_id uuid, answer_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  current_conversation_id uuid;
  current_question_id uuid;
  current_answer_id uuid;
begin
  perform public.assert_question_budget(
    target_guest_id, guest_daily_limit, deployment_hard_ceiling
  );

  if char_length(btrim(question_content)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'invalid_question';
  end if;
  if not exists (
    select 1 from public.notebooks
    where id = target_notebook_id
      and (is_example or owner_id = target_guest_id)
  ) then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  insert into public.conversations (notebook_id, owner_id)
  values (target_notebook_id, target_guest_id)
  on conflict (owner_id, notebook_id)
  do update set updated_at = timezone('utc', now())
  returning id into current_conversation_id;

  insert into public.messages (
    conversation_id, role, content, status, correlation_id, completed_at
  ) values (
    current_conversation_id, 'question', btrim(question_content), 'completed',
    request_correlation_id, timezone('utc', now())
  ) returning id into current_question_id;

  insert into public.messages (
    conversation_id, reply_to_message_id, role, content, status, correlation_id
  ) values (
    current_conversation_id, current_question_id, 'answer', '', 'pending',
    request_correlation_id
  ) returning id into current_answer_id;

  return query select current_conversation_id, current_question_id, current_answer_id;
end;
$$;

create or replace function public.record_model_usage(
  target_guest_id uuid,
  target_answer_id uuid,
  usage_provider text,
  usage_model text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.messages answers
    join public.conversations on conversations.id = answers.conversation_id
    where answers.id = target_answer_id
      and answers.role = 'answer'
      and answers.status = 'completed'
      and conversations.owner_id = target_guest_id
      and answers.model_provider = usage_provider
      and answers.model_name = usage_model
  ) then
    raise insufficient_privilege using message = 'answer_not_authorized';
  end if;

  insert into public.model_usage (guest_id, answer_message_id, provider, model)
  values (target_guest_id, target_answer_id, usage_provider, usage_model)
  on conflict (answer_message_id) do nothing;
end;
$$;

create or replace function public.complete_grounded_answer_with_usage(
  target_guest_id uuid,
  target_answer_id uuid,
  answer_content text,
  completion_kind text,
  completion_provider text,
  completion_model text,
  cited_passage_ids uuid[] default '{}'
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.complete_grounded_answer(
    target_guest_id, target_answer_id, answer_content, completion_kind,
    completion_provider, completion_model, cited_passage_ids
  );
  if completion_provider is not null and completion_model is not null then
    perform public.record_model_usage(
      target_guest_id, target_answer_id, completion_provider, completion_model
    );
  end if;
end;
$$;

create or replace function public.acquire_ingestion_lease(
  target_guest_id uuid,
  target_source_id uuid,
  request_correlation_id uuid,
  concurrent_limit integer
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if concurrent_limit < 1 or not exists (
    select 1 from public.sources
    join public.notebooks on notebooks.id = sources.notebook_id
    where sources.id = target_source_id
      and notebooks.owner_id = target_guest_id
      and not notebooks.is_example
  ) then
    raise insufficient_privilege using message = 'source_not_authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_guest_id::text));
  delete from public.ingestion_leases
  where expires_at < timezone('utc', now());

  if (select count(*) >= concurrent_limit from public.ingestion_leases where guest_id = target_guest_id) then
    raise exception using errcode = 'P0001', message = 'ingestion_limit_reached';
  end if;

  insert into public.ingestion_leases (source_id, guest_id, correlation_id)
  values (target_source_id, target_guest_id, request_correlation_id);
end;
$$;

create or replace function public.renew_ingestion_lease(
  target_guest_id uuid,
  target_source_id uuid,
  request_correlation_id uuid
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.ingestion_leases
  set expires_at = timezone('utc', now()) + interval '2 minutes'
  where source_id = target_source_id
    and guest_id = target_guest_id
    and correlation_id = request_correlation_id;
  if not found then
    raise insufficient_privilege using message = 'ingestion_lease_not_owned';
  end if;
end;
$$;

create or replace function public.release_ingestion_lease(
  target_guest_id uuid,
  target_source_id uuid,
  request_correlation_id uuid
)
returns void language sql security definer set search_path = '' as $$
  delete from public.ingestion_leases
  where source_id = target_source_id
    and guest_id = target_guest_id
    and correlation_id = request_correlation_id;
$$;

revoke all on function public.assert_question_budget(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.begin_budgeted_grounded_question(uuid, uuid, text, uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.record_model_usage(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_grounded_answer_with_usage(uuid, uuid, text, text, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.acquire_ingestion_lease(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.release_ingestion_lease(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.renew_ingestion_lease(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.assert_question_budget(uuid, integer, bigint) to service_role;
grant execute on function public.begin_budgeted_grounded_question(uuid, uuid, text, uuid, integer, bigint) to service_role;
grant execute on function public.record_model_usage(uuid, uuid, text, text) to service_role;
grant execute on function public.complete_grounded_answer_with_usage(uuid, uuid, text, text, text, text, uuid[]) to service_role;
grant execute on function public.acquire_ingestion_lease(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.release_ingestion_lease(uuid, uuid, uuid) to service_role;
grant execute on function public.renew_ingestion_lease(uuid, uuid, uuid) to service_role;

create or replace function public.create_private_notebook(
  target_guest_id uuid,
  notebook_title text,
  notebook_limit integer
)
returns setof public.notebooks
language plpgsql security definer set search_path = '' as $$
begin
  if target_guest_id is null or notebook_limit < 1 then
    raise exception using errcode = '22023', message = 'invalid_notebook_limit';
  end if;
  perform pg_advisory_xact_lock(hashtext('notebooks:' || target_guest_id::text));
  if (select count(*) >= notebook_limit from public.notebooks where owner_id = target_guest_id and not is_example) then
    raise exception using errcode = 'P0001', message = 'notebook_limit_reached';
  end if;
  return query
  insert into public.notebooks (owner_id, title)
  values (target_guest_id, notebook_title)
  returning *;
end;
$$;

create or replace function public.create_private_source(
  target_guest_id uuid,
  target_source_id uuid,
  target_notebook_id uuid,
  source_title text,
  source_kind text,
  source_content text,
  source_storage_path text,
  source_limit integer,
  source_embedding_provider text,
  source_embedding_model text,
  source_embedding_dimensions integer,
  source_embedding_pooling text
)
returns setof public.sources
language plpgsql security definer set search_path = '' as $$
begin
  if source_limit < 1 or not exists (
    select 1 from public.notebooks
    where id = target_notebook_id
      and owner_id = target_guest_id
      and not is_example
  ) then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;
  perform pg_advisory_xact_lock(hashtext('sources:' || target_notebook_id::text));
  if (select count(*) >= source_limit from public.sources where notebook_id = target_notebook_id) then
    raise exception using errcode = 'P0001', message = 'source_limit_reached';
  end if;
  return query
  insert into public.sources (
    id, notebook_id, title, kind, content, storage_path, processing_stage,
    attribution, license_name, license_url, embedding_provider,
    embedding_model, embedding_dimensions, embedding_pooling
  ) values (
    target_source_id, target_notebook_id, source_title, source_kind,
    source_content, source_storage_path, 'uploaded', 'Added by this Guest',
    'Private Source', '', source_embedding_provider, source_embedding_model,
    source_embedding_dimensions, source_embedding_pooling
  ) returning *;
end;
$$;

revoke all on function public.create_private_notebook(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.create_private_source(uuid, uuid, uuid, text, text, text, text, integer, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_private_notebook(uuid, text, integer) to service_role;
grant execute on function public.create_private_source(uuid, uuid, uuid, text, text, text, text, integer, text, text, integer, text) to service_role;

-- Notebook mutations pass through authenticated server routes so the runtime
-- environment limit cannot be bypassed with a direct PostgREST request.
revoke insert on table public.notebooks from authenticated;
drop trigger if exists notebooks_enforce_limit on public.notebooks;
revoke insert on table public.sources from authenticated;
drop trigger if exists sources_enforce_private_limit on public.sources;
