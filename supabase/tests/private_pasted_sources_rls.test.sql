begin;

select plan(11);

grant execute on function public.begin_grounded_question(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.retrieve_grounded_passages(uuid, uuid, extensions.vector, integer, double precision) to authenticated;
grant execute on function public.record_grounded_evidence(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.complete_grounded_answer(uuid, uuid, text, text, text, text, uuid[]) to authenticated;

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

reset role;
insert into public.notebooks (id, owner_id, title)
values ('50000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Private pasted research');

insert into public.sources (
  id, notebook_id, title, kind, attribution, license_name, license_url, content,
  processing_stage, embedding_provider, embedding_model, embedding_dimensions, embedding_pooling
)
values (
  '50000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000001',
  'Private interview notes',
  'pasted_text',
  'Added by this Guest',
  'Private Source',
  '',
  'Paragraph one.\n\nParagraph two contains grounded evidence.',
  'ready',
  'cloudflare-workers-ai',
  '@cf/baai/bge-small-en-v1.5',
  384,
  'cls'
);

insert into public.passages (
  id, source_id, ordinal, content, paragraph_start, paragraph_end, embedding
)
select
  '50000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000002',
  0,
  'Paragraph two contains grounded evidence.',
  2,
  2,
  embedding
from public.passages
where id = '00000000-0000-4000-8100-000000000001';

create temporary table private_question_embedding as
select embedding
from public.passages
where id = '50000000-0000-4000-8000-000000000003';
grant select on table private_question_embedding to authenticated;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';
set local request.jwt.claim.sub = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

select is((select count(*)::integer from public.sources where id = '50000000-0000-4000-8000-000000000002'), 1, 'The owning Guest reads their private pasted Source');
select is((select count(*)::integer from public.passages where source_id = '50000000-0000-4000-8000-000000000002'), 1, 'The owning Guest reads its Passage');
select is((select paragraph_start from public.passages where id = '50000000-0000-4000-8000-000000000003'), 2, 'The private Passage preserves its paragraph location');

select is(
  (
    select passage_id from public.retrieve_grounded_passages(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '50000000-0000-4000-8000-000000000001',
      (select embedding from private_question_embedding),
      1,
      0
    ) limit 1
  ),
  '50000000-0000-4000-8000-000000000003'::uuid,
  'Grounded Retrieval returns the owning Guest private ready Passage'
);

select lives_ok(
  $$select * from public.begin_grounded_question('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '50000000-0000-4000-8000-000000000001', 'What does paragraph two contain?', '50000000-0000-4000-8000-000000000004')$$,
  'The owning Guest can ask a Question against the private Notebook'
);
select lives_ok(
  $$select public.record_grounded_evidence('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select id from public.messages where role = 'question'), array['50000000-0000-4000-8000-000000000003']::uuid[])$$,
  'The private Passage can be recorded as evidence'
);
select lives_ok(
  $$select public.complete_grounded_answer('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', (select id from public.messages where role = 'answer'), 'It contains grounded evidence.', 'grounded', 'test', 'test', array['50000000-0000-4000-8000-000000000003']::uuid[])$$,
  'A grounded Answer can cite the private Passage'
);
select is((select paragraph_start from public.citations limit 1), 2, 'The persisted Citation retains its paragraph location');

set local request.jwt.claims =
  '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated","is_anonymous":true}';
set local request.jwt.claim.sub = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

select is((select count(*)::integer from public.sources where id = '50000000-0000-4000-8000-000000000002'), 0, 'Another Guest cannot read the private Source');
select ok(not has_table_privilege('authenticated', 'public.sources', 'update'), 'Guests cannot mutate Sources directly');
select throws_ok(
  $$select * from public.retrieve_grounded_passages('ffffffff-ffff-4fff-8fff-ffffffffffff', '50000000-0000-4000-8000-000000000001', array_fill(0::real, array[384])::extensions.vector, 1, 0)$$,
  '42501',
  'notebook_not_authorized',
  'Another Guest cannot retrieve or question the private Source'
);

select * from finish();
rollback;
