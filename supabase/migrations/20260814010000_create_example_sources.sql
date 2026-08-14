create extension if not exists vector with schema extensions;

alter table public.notebooks
  alter column owner_id drop not null,
  add column is_example boolean not null default false,
  add constraint notebooks_ownership_kind check (
    (is_example and owner_id is null)
    or (not is_example and owner_id is not null)
  );

comment on table public.notebooks is
  'Private research Notebooks and the shared, immutable Example Notebook.';

create unique index notebooks_single_example_idx
  on public.notebooks (is_example)
  where is_example;

create table public.sources (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  title text not null,
  kind text not null,
  original_url text,
  attribution text not null,
  license_name text not null,
  license_url text not null,
  content text not null,
  processing_stage text not null default 'ready',
  embedding_model text not null,
  embedding_dimensions integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint sources_kind check (kind in ('pdf', 'pasted_text')),
  constraint sources_ready_seed check (processing_stage = 'ready'),
  constraint sources_embedding_configuration check (
    embedding_model = 'sentence-transformers/all-MiniLM-L6-v2'
    and embedding_dimensions = 384
  ),
  constraint sources_content_present check (char_length(btrim(content)) > 0)
);

comment on table public.sources is
  'Attributed readable Sources. Seeded Example Sources are ready and immutable to Guests.';

create index sources_notebook_created_idx
  on public.sources (notebook_id, created_at);

create table public.passages (
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  ordinal integer not null,
  content text not null,
  page_number integer,
  paragraph_start integer,
  paragraph_end integer,
  embedding extensions.vector(384) not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint passages_ordinal_nonnegative check (ordinal >= 0),
  constraint passages_content_present check (char_length(btrim(content)) > 0),
  constraint passages_location_present check (
    (page_number is not null and paragraph_start is null and paragraph_end is null)
    or (
      page_number is null
      and paragraph_start is not null
      and paragraph_end is not null
      and paragraph_end >= paragraph_start
    )
  ),
  unique (source_id, ordinal)
);

comment on table public.passages is
  'Ordered, location-aware evidence embedded with the configured Source model.';

create index passages_source_ordinal_idx
  on public.passages (source_id, ordinal);

alter table public.sources enable row level security;
alter table public.sources force row level security;
alter table public.passages enable row level security;
alter table public.passages force row level security;

create policy "Guests read Sources in readable Notebooks"
on public.sources
for select
to authenticated
using (
  exists (
    select 1
    from public.notebooks
    where notebooks.id = sources.notebook_id
  )
);

create policy "Guests read Passages in readable Notebooks"
on public.passages
for select
to authenticated
using (
  exists (
    select 1
    from public.sources
    where sources.id = passages.source_id
  )
);

revoke all on table public.sources from anon, authenticated;
revoke all on table public.passages from anon, authenticated;
grant select on table public.sources to authenticated;
grant select (
  id,
  source_id,
  ordinal,
  content,
  page_number,
  paragraph_start,
  paragraph_end,
  created_at
) on table public.passages to authenticated;

create policy "Guests read the Example Notebook"
on public.notebooks
for select
to authenticated
using (is_example);

create or replace function public.enforce_notebook_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_example then
    if (select auth.uid()) is not null then
      raise insufficient_privilege using message = 'notebook_owner_mismatch';
    end if;
    return new;
  end if;

  if (select auth.uid()) is distinct from new.owner_id then
    raise insufficient_privilege using message = 'notebook_owner_mismatch';
  end if;

  if (
    select count(*) >= 5
    from public.notebooks
    where owner_id = new.owner_id
      and not is_example
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'notebook_limit_reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notebook_limit() from public, anon, authenticated;
