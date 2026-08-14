create table public.notes (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  origin_answer_id uuid not null references public.messages (id) on delete cascade,
  origin_question text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notes_origin_question_length check (
    char_length(btrim(origin_question)) between 1 and 1000
  ),
  constraint notes_content_length check (
    char_length(btrim(content)) between 1 and 12000
  ),
  unique (owner_id, origin_answer_id)
);

comment on table public.notes is
  'Private Guest notes saved from completed grounded Answers.';

create index notes_owner_notebook_updated_idx
  on public.notes (owner_id, notebook_id, updated_at desc);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

alter table public.notes enable row level security;
alter table public.notes force row level security;

create policy "Guests read their own Notes"
on public.notes for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Guests save Notes from their Answers"
on public.notes for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and exists (
    select 1
    from public.messages answers
    join public.conversations
      on conversations.id = answers.conversation_id
    where answers.id = notes.origin_answer_id
      and answers.role = 'answer'
      and answers.status = 'completed'
      and conversations.owner_id = (select auth.uid())
      and conversations.notebook_id = notes.notebook_id
  )
);

create policy "Guests edit their own Notes"
on public.notes for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Guests delete their own Notes"
on public.notes for delete to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.notes from anon;
grant select, insert, update (content), delete on table public.notes to authenticated;
