begin;

select plan(31);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    true
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    true
  );

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","is_anonymous":true}';

insert into public.notebooks (id, owner_id, title)
values (
  '40000000-0000-4000-8000-000000000002',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Guest D private research'
);

reset role;

insert into public.sources (
  id,
  notebook_id,
  title,
  kind,
  attribution,
  license_name,
  license_url,
  content,
  processing_stage,
  embedding_provider,
  embedding_model,
  embedding_dimensions,
  embedding_pooling
)
values
  (
    '40000000-0000-4000-8000-000000000031',
    '00000000-0000-4000-8000-000000000003',
    'Unready decoy',
    'pasted_text',
    'Test fixture',
    'Test fixture',
    'https://example.com/license',
    'This Source must be filtered before similarity ranking.',
    'failed',
    'cloudflare-workers-ai',
    '@cf/baai/bge-small-en-v1.5',
    384,
    'cls'
  ),
  (
    '40000000-0000-4000-8000-000000000032',
    '40000000-0000-4000-8000-000000000002',
    'Other Guest Source',
    'pasted_text',
    'Test fixture',
    'Test fixture',
    'https://example.com/license',
    'This Source belongs to another Guest.',
    'ready',
    'cloudflare-workers-ai',
    '@cf/baai/bge-small-en-v1.5',
    384,
    'cls'
  );

insert into public.passages (
  id,
  source_id,
  ordinal,
  content,
  paragraph_start,
  paragraph_end,
  embedding
)
select
  '40000000-0000-4000-8300-000000000001',
  '40000000-0000-4000-8000-000000000031',
  0,
  'Unready decoy Passage',
  1,
  1,
  embedding
from public.passages
where id = '00000000-0000-4000-8100-000000000001';

insert into public.passages (
  id,
  source_id,
  ordinal,
  content,
  paragraph_start,
  paragraph_end,
  embedding
)
select
  '40000000-0000-4000-8400-000000000001',
  '40000000-0000-4000-8000-000000000032',
  0,
  'Other Guest Passage',
  1,
  1,
  embedding
from public.passages
where id = '00000000-0000-4000-8100-000000000001';

create temporary table retrieval_evaluation (
  question text not null,
  expected_passage_id uuid not null,
  question_embedding extensions.vector(384) not null
);

insert into retrieval_evaluation (question, expected_passage_id, question_embedding)
select fixture.question, fixture.expected_passage_id, passages.embedding
from (
  values
    (
      'What makes an AI system trustworthy?',
      '00000000-0000-4000-8100-000000000001'::uuid
    ),
    (
      'What are the four AI RMF functions?',
      '00000000-0000-4000-8100-000000000002'::uuid
    ),
    (
      'How does governance connect development to organizational values?',
      '00000000-0000-4000-8100-000000000003'::uuid
    ),
    (
      'What does confabulation mean?',
      '00000000-0000-4000-8200-000000000001'::uuid
    ),
    (
      'How should teams establish data provenance?',
      '00000000-0000-4000-8200-000000000002'::uuid
    )
) as fixture(question, expected_passage_id)
join public.passages on passages.id = fixture.expected_passage_id;

grant select on table retrieval_evaluation to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","is_anonymous":true}';

select is(
  (
    select count(*)::integer
    from retrieval_evaluation fixture
    where (
      select passage_id
      from public.retrieve_passages(
        '00000000-0000-4000-8000-000000000003',
        fixture.question_embedding,
        1,
        0
      )
      limit 1
    ) = fixture.expected_passage_id
  ),
  5,
  'Five deterministic Questions retrieve their expected supporting Passages'
);

select is(
  (
    select count(*)::integer
    from public.retrieve_passages(
      '00000000-0000-4000-8000-000000000003',
      (select question_embedding from retrieval_evaluation limit 1),
      8,
      0
    )
    where passage_id = '40000000-0000-4000-8300-000000000001'
  ),
  0,
  'Retrieval excludes Passages whose Source is not ready before ranking'
);

select throws_ok(
  $$select * from public.retrieve_passages('40000000-0000-4000-8000-000000000002', (select question_embedding from retrieval_evaluation limit 1), 5, 0)$$,
  '42501',
  'notebook_not_authorized',
  'Retrieval rejects a Notebook the current Guest cannot read'
);

select lives_ok(
  $$select * from public.begin_question('00000000-0000-4000-8000-000000000003', 'What makes AI trustworthy?', '40000000-0000-4000-8500-000000000001')$$,
  'Guest C can begin a Question in the Example Notebook'
);

select is(
  (select count(*)::integer from public.conversations),
  1,
  'The first Question creates one private Conversation'
);

select is(
  (select count(*)::integer from public.messages),
  2,
  'Beginning a Question persists the Question and a pending Answer'
);

select lives_ok(
  $$select * from public.begin_question('00000000-0000-4000-8000-000000000003', 'How should teams address confabulation?', '40000000-0000-4000-8500-000000000002')$$,
  'Guest C can ask another Question'
);

select is(
  (select count(*)::integer from public.conversations),
  1,
  'A Guest still has only one Conversation in the Notebook'
);

select lives_ok(
  $$select public.set_question_evidence((select id from public.messages where role = 'question' and content = 'What makes AI trustworthy?'), array['00000000-0000-4000-8100-000000000001']::uuid[])$$,
  'Retrieved evidence is recorded on the Question'
);

select lives_ok(
  $$select public.complete_answer((select answers.id from public.messages answers join public.messages questions on questions.id = answers.reply_to_message_id where questions.content = 'What makes AI trustworthy?'), 'Trustworthy AI balances several characteristics in context.', 'grounded', 'cloudflare-workers-ai', '@cf/meta/llama-3.1-8b-instruct-fast', array['00000000-0000-4000-8100-000000000001']::uuid[])$$,
  'A supported Answer completes with a Citation from its evidence set'
);

select is(
  (
    select count(*)::integer
    from public.messages
    where role = 'answer'
      and status = 'completed'
      and answer_kind = 'grounded'
  ),
  1,
  'The grounded Answer is marked complete'
);

select is(
  (select count(*)::integer from public.citations),
  1,
  'The completed grounded Answer has one validated Citation'
);

select is(
  (
    select count(*)::integer
    from public.citations
    where source_title = 'Artificial Intelligence Risk Management Framework (AI RMF 1.0)'
      and page_number = 12
      and passage_content like 'For AI systems to be trustworthy%'
  ),
  1,
  'The Citation snapshots the exact Source title, Passage, and PDF page'
);

select lives_ok(
  $$select * from public.begin_question('00000000-0000-4000-8000-000000000003', 'Can a model invent a Citation?', '40000000-0000-4000-8500-000000000003')$$,
  'A Citation validation fixture Question begins'
);

select lives_ok(
  $$select public.set_question_evidence((select id from public.messages where role = 'question' and content = 'Can a model invent a Citation?'), array['00000000-0000-4000-8100-000000000001']::uuid[])$$,
  'The validation fixture records one evidence Passage'
);

select throws_ok(
  $$select public.complete_answer((select answers.id from public.messages answers join public.messages questions on questions.id = answers.reply_to_message_id where questions.content = 'Can a model invent a Citation?'), 'Invented evidence.', 'grounded', 'cloudflare-workers-ai', '@cf/meta/llama-3.1-8b-instruct-fast', array['00000000-0000-4000-8100-000000000002']::uuid[])$$,
  '22023',
  'citation_outside_evidence',
  'The database rejects a Citation outside the retrieved evidence set'
);

select is(
  (
    select status
    from public.messages answers
    join public.messages questions on questions.id = answers.reply_to_message_id
    where questions.content = 'Can a model invent a Citation?'
  ),
  'pending',
  'An invalid Citation never completes the Answer'
);

select is(
  (
    select count(*)::integer
    from public.citations citations
    join public.messages answers on answers.id = citations.answer_message_id
    join public.messages questions on questions.id = answers.reply_to_message_id
    where questions.content = 'Can a model invent a Citation?'
  ),
  0,
  'An invalid Citation is never silently persisted'
);

select lives_ok(
  $$select public.fail_answer((select answers.id from public.messages answers join public.messages questions on questions.id = answers.reply_to_message_id where questions.content = 'Can a model invent a Citation?'))$$,
  'The invalid Answer becomes a safe failure'
);

select is(
  (
    select status
    from public.messages answers
    join public.messages questions on questions.id = answers.reply_to_message_id
    where questions.content = 'Can a model invent a Citation?'
  ),
  'failed',
  'The safe failure remains visibly incomplete'
);

select lives_ok(
  $$select * from public.begin_question('00000000-0000-4000-8000-000000000003', 'Who won the 2026 World Cup?', '40000000-0000-4000-8500-000000000004')$$,
  'An unsupported Question begins normally'
);

select lives_ok(
  $$select public.set_question_evidence((select id from public.messages where role = 'question' and content = 'Who won the 2026 World Cup?'), '{}'::uuid[])$$,
  'An unsupported Question records an empty evidence set'
);

select lives_ok(
  $$select public.complete_answer((select answers.id from public.messages answers join public.messages questions on questions.id = answers.reply_to_message_id where questions.content = 'Who won the 2026 World Cup?'), 'The Sources do not contain enough evidence to answer that Question.', 'insufficient_evidence', null, null, '{}'::uuid[])$$,
  'An unsupported Question completes as insufficient evidence'
);

select is(
  (
    select count(*)::integer
    from public.messages answers
    where answers.answer_kind = 'insufficient_evidence'
      and answers.status = 'completed'
      and not exists (
        select 1
        from public.citations
        where citations.answer_message_id = answers.id
      )
  ),
  1,
  'The insufficient-evidence Answer has no fabricated Citations'
);

set local request.jwt.claims =
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","is_anonymous":true}';

select is(
  (select count(*)::integer from public.conversations),
  0,
  'Guest D cannot see Guest C Conversation'
);

select is(
  (select count(*)::integer from public.messages),
  0,
  'Guest D cannot see Guest C Messages'
);

select is(
  (select count(*)::integer from public.citations),
  0,
  'Guest D cannot see Guest C Citations'
);

select throws_ok(
  $$insert into public.conversations (notebook_id, owner_id) values ('00000000-0000-4000-8000-000000000003', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')$$,
  '42501',
  'permission denied for table conversations',
  'Guests cannot bypass Grounded Answering with direct Conversation writes'
);

select lives_ok(
  $$select * from public.begin_question('00000000-0000-4000-8000-000000000003', 'What is the AI RMF?', '40000000-0000-4000-8500-000000000005')$$,
  'Guest D can create their own Example Notebook Conversation'
);

select is(
  (select count(*)::integer from public.conversations),
  1,
  'Guest D sees exactly their own Conversation'
);

set local request.jwt.claims =
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","is_anonymous":true}';

select is(
  (select count(*)::integer from public.conversations),
  1,
  'Guest C still sees exactly their own Conversation'
);

select * from finish();
rollback;
