create extension if not exists pgcrypto with schema extensions;

create table public.notebooks (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notebooks_title_length check (
    title = btrim(title)
    and char_length(title) between 1 and 80
  )
);

comment on table public.notebooks is
  'Private research Notebooks owned by one authenticated Guest.';

create index notebooks_owner_updated_idx
  on public.notebooks (owner_id, updated_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger notebooks_set_updated_at
before update on public.notebooks
for each row execute function public.set_updated_at();

create function public.enforce_notebook_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is distinct from new.owner_id then
    raise insufficient_privilege using message = 'notebook_owner_mismatch';
  end if;

  if (
    select count(*) >= 5
    from public.notebooks
    where owner_id = new.owner_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'notebook_limit_reached';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_notebook_limit() from public, anon, authenticated;

create trigger notebooks_enforce_limit
before insert on public.notebooks
for each row execute function public.enforce_notebook_limit();

alter table public.notebooks enable row level security;
alter table public.notebooks force row level security;

create policy "Guests read their own Notebooks"
on public.notebooks
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Guests create their own Notebooks"
on public.notebooks
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Guests rename their own Notebooks"
on public.notebooks
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Guests delete their own Notebooks"
on public.notebooks
for delete
to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.notebooks from anon;
grant select, insert, update (title), delete on table public.notebooks to authenticated;
