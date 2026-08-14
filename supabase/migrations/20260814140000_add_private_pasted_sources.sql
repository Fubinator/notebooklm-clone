alter table public.sources
  alter column attribution set default 'Private Source',
  alter column license_name set default 'Private',
  alter column license_url set default '',
  alter column embedding_provider set default 'cloudflare-workers-ai',
  alter column embedding_model set default '@cf/baai/bge-small-en-v1.5',
  alter column embedding_dimensions set default 384,
  alter column embedding_pooling set default 'cls',
  add column character_count integer generated always as (char_length(content)) stored,
  add column failure_category text,
  add column retry_stage text,
  add column attempt_count integer not null default 0,
  add column correlation_id uuid,
  add column updated_at timestamptz not null default timezone('utc', now()),
  add constraint sources_pasted_text_limit check (
    kind <> 'pasted_text'
    or (character_count between 1 and 50000 and char_length(content) <= 50000)
  ),
  add constraint sources_retry_stage check (
    retry_stage is null or retry_stage in ('extracting', 'chunking', 'embedding')
  ),
  add constraint sources_failure_metadata check (
    (processing_stage = 'failed' and failure_category is not null and retry_stage is not null and correlation_id is not null)
    or (processing_stage <> 'failed' and failure_category is null and retry_stage is null)
  );

alter table public.passages alter column embedding drop not null;

create trigger sources_set_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

comment on column public.sources.failure_category is
  'Safe failure category; never provider response content.';
comment on column public.sources.retry_stage is
  'Processing Stage that can be resumed after a failed attempt.';

create or replace function public.enforce_private_source_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' and not exists (
    select 1 from public.notebooks
    where notebooks.id = new.notebook_id
      and notebooks.owner_id = (select auth.uid())
      and not notebooks.is_example
  ) then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  if (
    select count(*) >= 5 from public.sources
    where sources.notebook_id = new.notebook_id
  ) then
    raise exception using errcode = 'P0001', message = 'source_limit_reached';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_private_source_limit() from public, anon, authenticated;

create trigger sources_enforce_private_limit
before insert on public.sources
for each row execute function public.enforce_private_source_limit();
