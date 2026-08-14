begin;

select plan(10);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';

insert into public.notebooks (id, owner_id, title)
values ('60000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Guest E research');

reset role;

insert into public.conversations (id, notebook_id, owner_id)
values ('60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');

insert into public.messages (id, conversation_id, role, content, status, completed_at)
values ('60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000002', 'question', 'What evidence matters?', 'completed', timezone('utc', now()));

insert into public.messages (id, conversation_id, reply_to_message_id, role, content, status, answer_kind, completed_at)
values ('60000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000003', 'answer', 'Validated evidence matters.', 'completed', 'insufficient_evidence', timezone('utc', now()));

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';

select lives_ok(
  $$insert into public.notes (id, notebook_id, owner_id, origin_answer_id, content) values ('60000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '60000000-0000-4000-8000-000000000004', 'Validated evidence matters.')$$,
  'Guest E can save their completed Answer as a Note'
);

select is((select origin_question from public.notes), 'What evidence matters?', 'The database derives the originating Question from the Answer');
select is((select count(*)::integer from public.notes), 1, 'Guest E reads their Note');
select lives_ok($$update public.notes set content = 'Edited privately' where id = '60000000-0000-4000-8000-000000000005'$$, 'Guest E can edit their Note');
select is((select content from public.notes), 'Edited privately', 'The owner sees the edited Note');

set local request.jwt.claims =
  '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated","is_anonymous":true}';

select is((select count(*)::integer from public.notes), 0, 'Guest F cannot read Guest E Notes');
select lives_ok($$update public.notes set content = 'Intrusion' where id = '60000000-0000-4000-8000-000000000005'$$, 'Updating another Guest Note exposes no row');
select lives_ok($$delete from public.notes where id = '60000000-0000-4000-8000-000000000005'$$, 'Deleting another Guest Note exposes no row');
select throws_ok(
  $$insert into public.notes (notebook_id, owner_id, origin_answer_id, content) values ('60000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffffffff', '60000000-0000-4000-8000-000000000004', 'Stolen')$$,
  '42501',
  'new row violates row-level security policy for table "notes"',
  'Guest F cannot save a Note from Guest E Answer'
);

set local request.jwt.claims =
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated","is_anonymous":true}';

select is((select content from public.notes), 'Edited privately', 'Another Guest could not mutate the Note');

select * from finish();
rollback;
