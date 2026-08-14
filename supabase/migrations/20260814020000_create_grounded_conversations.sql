alter table public.sources
  drop constraint sources_ready_seed,
  add constraint sources_processing_stage check (
    processing_stage in (
      'uploaded',
      'extracting',
      'chunking',
      'embedding',
      'ready',
      'failed'
    )
  );

create table public.conversations (
  id uuid primary key default extensions.gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, notebook_id)
);

comment on table public.conversations is
  'One private persistent Conversation for a Guest in a Notebook.';

create table public.messages (
  id uuid primary key default extensions.gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  reply_to_message_id uuid references public.messages (id) on delete cascade,
  ordinal bigint generated always as identity,
  role text not null,
  content text not null,
  status text not null,
  answer_kind text,
  evidence_passage_ids uuid[] not null default '{}',
  correlation_id uuid not null default extensions.gen_random_uuid(),
  model_provider text,
  model_name text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  constraint messages_role check (role in ('question', 'answer')),
  constraint messages_status check (status in ('pending', 'completed', 'failed')),
  constraint messages_answer_kind check (
    answer_kind is null
    or answer_kind in ('grounded', 'insufficient_evidence', 'safe_failure')
  ),
  constraint messages_content_length check (char_length(content) <= 12000),
  constraint messages_shape check (
    (
      role = 'question'
      and reply_to_message_id is null
      and status = 'completed'
      and answer_kind is null
      and char_length(btrim(content)) between 1 and 1000
      and completed_at is not null
    )
    or (
      role = 'answer'
      and reply_to_message_id is not null
      and cardinality(evidence_passage_ids) = 0
      and (
        (status = 'pending' and content = '' and answer_kind is null and completed_at is null)
        or (
          status = 'completed'
          and char_length(btrim(content)) > 0
          and answer_kind is not null
          and answer_kind in ('grounded', 'insufficient_evidence')
          and completed_at is not null
        )
        or (
          status = 'failed'
          and char_length(btrim(content)) > 0
          and answer_kind is not null
          and answer_kind = 'safe_failure'
          and completed_at is null
        )
      )
    )
  )
);

comment on table public.messages is
  'Persisted Questions and final validated Answers. Pending or failed output is never complete.';

create unique index messages_one_answer_per_question_idx
  on public.messages (reply_to_message_id)
  where role = 'answer';

create index messages_conversation_ordinal_idx
  on public.messages (conversation_id, ordinal);

create table public.citations (
  id uuid primary key default extensions.gen_random_uuid(),
  answer_message_id uuid not null references public.messages (id) on delete cascade,
  passage_id uuid references public.passages (id) on delete set null,
  display_order integer not null,
  source_title text not null,
  passage_content text not null,
  page_number integer,
  paragraph_start integer,
  paragraph_end integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint citations_order_positive check (display_order > 0),
  constraint citations_location_present check (
    (page_number is not null and paragraph_start is null and paragraph_end is null)
    or (
      page_number is null
      and paragraph_start is not null
      and paragraph_end is not null
      and paragraph_end >= paragraph_start
    )
  ),
  unique (answer_message_id, display_order),
  unique (answer_message_id, passage_id)
);

comment on table public.citations is
  'Validated Answer evidence with a durable snapshot of its exact Source location.';

alter table public.conversations enable row level security;
alter table public.conversations force row level security;
alter table public.messages enable row level security;
alter table public.messages force row level security;
alter table public.citations enable row level security;
alter table public.citations force row level security;

create policy "Guests read their Conversations"
on public.conversations
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Guests read their Messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.owner_id = (select auth.uid())
  )
);

create policy "Guests read their Citations"
on public.citations
for select
to authenticated
using (
  exists (
    select 1
    from public.messages
    join public.conversations
      on conversations.id = messages.conversation_id
    where messages.id = citations.answer_message_id
      and conversations.owner_id = (select auth.uid())
  )
);

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.citations from anon, authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.citations to authenticated;

create or replace function public.begin_question(
  target_notebook_id uuid,
  question_content text,
  request_correlation_id uuid
)
returns table (
  conversation_id uuid,
  question_id uuid,
  answer_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_guest_id uuid := auth.uid();
  current_conversation_id uuid;
  current_question_id uuid;
  current_answer_id uuid;
begin
  if current_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if char_length(btrim(question_content)) not between 1 and 1000 then
    raise exception using errcode = '22023', message = 'invalid_question';
  end if;

  if not exists (
    select 1
    from public.notebooks
    where notebooks.id = target_notebook_id
      and (notebooks.is_example or notebooks.owner_id = current_guest_id)
  ) then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  if (
    select count(*) >= 20
    from public.messages answers
    join public.conversations
      on conversations.id = answers.conversation_id
    where conversations.owner_id = current_guest_id
      and answers.role = 'answer'
      and answers.status = 'completed'
      and answers.answer_kind = 'grounded'
      and answers.completed_at >= (
        date_trunc('day', timezone('utc', now())) at time zone 'utc'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'question_limit_reached';
  end if;

  insert into public.conversations (notebook_id, owner_id)
  values (target_notebook_id, current_guest_id)
  on conflict (owner_id, notebook_id)
  do update set updated_at = timezone('utc', now())
  returning id into current_conversation_id;

  insert into public.messages (
    conversation_id,
    role,
    content,
    status,
    correlation_id,
    completed_at
  )
  values (
    current_conversation_id,
    'question',
    btrim(question_content),
    'completed',
    request_correlation_id,
    timezone('utc', now())
  )
  returning id into current_question_id;

  insert into public.messages (
    conversation_id,
    reply_to_message_id,
    role,
    content,
    status,
    correlation_id
  )
  values (
    current_conversation_id,
    current_question_id,
    'answer',
    '',
    'pending',
    request_correlation_id
  )
  returning id into current_answer_id;

  return query select
    current_conversation_id,
    current_question_id,
    current_answer_id;
end;
$$;

create or replace function public.retrieve_passages(
  target_notebook_id uuid,
  question_embedding extensions.vector(384),
  match_count integer default 5,
  minimum_similarity double precision default 0.42
)
returns table (
  passage_id uuid,
  source_id uuid,
  source_title text,
  source_kind text,
  content text,
  page_number integer,
  paragraph_start integer,
  paragraph_end integer,
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_guest_id uuid := auth.uid();
begin
  if current_guest_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.notebooks
    where notebooks.id = target_notebook_id
      and (notebooks.is_example or notebooks.owner_id = current_guest_id)
  ) then
    raise insufficient_privilege using message = 'notebook_not_authorized';
  end if;

  return query
  with eligible_passages as (
    select
      passages.id as passage_id,
      sources.id as source_id,
      sources.title as source_title,
      sources.kind as source_kind,
      passages.content,
      passages.page_number,
      passages.paragraph_start,
      passages.paragraph_end,
      1 - (passages.embedding <=> question_embedding) as similarity
    from public.passages
    join public.sources on sources.id = passages.source_id
    where sources.notebook_id = target_notebook_id
      and sources.processing_stage = 'ready'
      and sources.embedding_provider = 'cloudflare-workers-ai'
      and sources.embedding_model = '@cf/baai/bge-small-en-v1.5'
      and sources.embedding_dimensions = 384
      and sources.embedding_pooling = 'cls'
  )
  select
    eligible_passages.passage_id,
    eligible_passages.source_id,
    eligible_passages.source_title,
    eligible_passages.source_kind,
    eligible_passages.content,
    eligible_passages.page_number,
    eligible_passages.paragraph_start,
    eligible_passages.paragraph_end,
    eligible_passages.similarity
  from eligible_passages
  where eligible_passages.similarity >= greatest(0, least(minimum_similarity, 1))
  order by eligible_passages.similarity desc, eligible_passages.passage_id
  limit greatest(1, least(match_count, 8));
end;
$$;

create or replace function public.set_question_evidence(
  target_question_id uuid,
  evidence_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_guest_id uuid := auth.uid();
  target_notebook_id uuid;
begin
  if evidence_ids is null then
    raise exception using errcode = '22023', message = 'invalid_evidence';
  end if;

  select conversations.notebook_id
  into target_notebook_id
  from public.messages questions
  join public.conversations
    on conversations.id = questions.conversation_id
  join public.messages answers
    on answers.reply_to_message_id = questions.id
  where questions.id = target_question_id
    and questions.role = 'question'
    and answers.status = 'pending'
    and conversations.owner_id = current_guest_id;

  if target_notebook_id is null then
    raise insufficient_privilege using message = 'question_not_authorized';
  end if;

  if cardinality(evidence_ids) <> (
    select count(distinct evidence_id)
    from unnest(evidence_ids) as evidence(evidence_id)
  ) then
    raise exception using errcode = '22023', message = 'duplicate_evidence';
  end if;

  if cardinality(evidence_ids) <> (
    select count(*)
    from public.passages
    join public.sources on sources.id = passages.source_id
    where passages.id = any(evidence_ids)
      and sources.notebook_id = target_notebook_id
      and sources.processing_stage = 'ready'
  ) then
    raise exception using errcode = '22023', message = 'invalid_evidence';
  end if;

  update public.messages
  set evidence_passage_ids = evidence_ids
  where id = target_question_id;
end;
$$;

create or replace function public.complete_answer(
  target_answer_id uuid,
  answer_content text,
  completion_kind text,
  completion_provider text,
  completion_model text,
  cited_passage_ids uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_guest_id uuid := auth.uid();
  recorded_evidence_ids uuid[];
begin
  if cited_passage_ids is null then
    raise exception using errcode = '22023', message = 'invalid_citations';
  end if;

  select questions.evidence_passage_ids
  into recorded_evidence_ids
  from public.messages answers
  join public.messages questions on questions.id = answers.reply_to_message_id
  join public.conversations on conversations.id = answers.conversation_id
  where answers.id = target_answer_id
    and answers.role = 'answer'
    and answers.status = 'pending'
    and conversations.owner_id = current_guest_id
  for update of answers;

  if recorded_evidence_ids is null then
    raise insufficient_privilege using message = 'answer_not_authorized';
  end if;

  if char_length(btrim(answer_content)) not between 1 and 12000 then
    raise exception using errcode = '22023', message = 'invalid_answer';
  end if;

  if completion_kind = 'grounded' then
    if completion_provider is null or completion_model is null then
      raise exception using errcode = '22023', message = 'model_metadata_required';
    end if;

    if cardinality(cited_passage_ids) = 0 then
      raise exception using errcode = '22023', message = 'citation_required';
    end if;

    if cardinality(cited_passage_ids) <> (
      select count(distinct cited_id)
      from unnest(cited_passage_ids) as cited(cited_id)
    ) then
      raise exception using errcode = '22023', message = 'duplicate_citation';
    end if;

    if not cited_passage_ids <@ recorded_evidence_ids then
      raise exception using errcode = '22023', message = 'citation_outside_evidence';
    end if;

    if cardinality(cited_passage_ids) <> (
      select count(*)
      from public.passages
      where passages.id = any(cited_passage_ids)
    ) then
      raise exception using errcode = '22023', message = 'citation_unavailable';
    end if;
  elsif completion_kind = 'insufficient_evidence' then
    if cardinality(cited_passage_ids) <> 0 then
      raise exception using errcode = '22023', message = 'citation_not_allowed';
    end if;
  else
    raise exception using errcode = '22023', message = 'invalid_completion_kind';
  end if;

  insert into public.citations (
    answer_message_id,
    passage_id,
    display_order,
    source_title,
    passage_content,
    page_number,
    paragraph_start,
    paragraph_end
  )
  select
    target_answer_id,
    passages.id,
    cited.ordinality::integer,
    sources.title,
    passages.content,
    passages.page_number,
    passages.paragraph_start,
    passages.paragraph_end
  from unnest(cited_passage_ids) with ordinality as cited(passage_id, ordinality)
  join public.passages on passages.id = cited.passage_id
  join public.sources on sources.id = passages.source_id
  order by cited.ordinality;

  update public.messages
  set
    content = btrim(answer_content),
    status = 'completed',
    answer_kind = completion_kind,
    model_provider = completion_provider,
    model_name = completion_model,
    completed_at = timezone('utc', now())
  where id = target_answer_id;

  update public.conversations
  set updated_at = timezone('utc', now())
  where id = (
    select conversation_id
    from public.messages
    where id = target_answer_id
  );
end;
$$;

create or replace function public.fail_answer(target_answer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages answers
  set
    content = 'I could not produce an Answer whose Citations could be verified. Please try the Question again.',
    status = 'failed',
    answer_kind = 'safe_failure',
    model_provider = null,
    model_name = null,
    completed_at = null
  from public.conversations
  where answers.id = target_answer_id
    and answers.conversation_id = conversations.id
    and answers.role = 'answer'
    and answers.status = 'pending'
    and conversations.owner_id = auth.uid();

  if not found then
    raise insufficient_privilege using message = 'answer_not_authorized';
  end if;
end;
$$;

revoke all on function public.begin_question(uuid, text, uuid) from public, anon;
revoke all on function public.retrieve_passages(uuid, extensions.vector, integer, double precision) from public, anon;
revoke all on function public.set_question_evidence(uuid, uuid[]) from public, anon;
revoke all on function public.complete_answer(uuid, text, text, text, text, uuid[]) from public, anon;
revoke all on function public.fail_answer(uuid) from public, anon;

grant execute on function public.begin_question(uuid, text, uuid) to authenticated;
grant execute on function public.retrieve_passages(uuid, extensions.vector, integer, double precision) to authenticated;
grant execute on function public.set_question_evidence(uuid, uuid[]) to authenticated;
grant execute on function public.complete_answer(uuid, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.fail_answer(uuid) to authenticated;
