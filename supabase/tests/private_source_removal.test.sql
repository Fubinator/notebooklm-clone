begin;

select plan(22);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  ('19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true),
  ('19222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);

insert into public.notebooks (id, owner_id, title)
values
  ('19000000-0000-4000-8000-000000000001', '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Removal research'),
  ('19000000-0000-4000-8000-000000000002', '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Whole Notebook removal');

insert into public.sources (
  id, notebook_id, title, kind, content, processing_stage
) values
  (
    '19000000-0000-4000-8000-000000000011',
    '19000000-0000-4000-8000-000000000001',
    'Owned Source', 'pasted_text', 'Grounded removal evidence.', 'ready'
  ),
  (
    '19000000-0000-4000-8000-000000000012',
    '19000000-0000-4000-8000-000000000002',
    'Notebook Source', 'pasted_text', 'Notebook removal evidence.', 'uploaded'
  );

insert into public.passages (
  id, source_id, ordinal, content, paragraph_start, paragraph_end
) values (
  '19000000-0000-4000-8000-000000000021',
  '19000000-0000-4000-8000-000000000011',
  0, 'Grounded removal evidence.', 1, 1
);

insert into public.conversations (id, notebook_id, owner_id)
values (
  '19000000-0000-4000-8000-000000000031',
  '19000000-0000-4000-8000-000000000001',
  '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

insert into public.messages (
  id, conversation_id, role, content, status, evidence_passage_ids, completed_at
) values
  (
    '19000000-0000-4000-8000-000000000041',
    '19000000-0000-4000-8000-000000000031',
    'question', 'What supports removal?', 'completed',
    array['19000000-0000-4000-8000-000000000021'::uuid],
    timezone('utc', now())
  ),
  (
    '19000000-0000-4000-8000-000000000043',
    '19000000-0000-4000-8000-000000000031',
    'question', 'Can a deleting Source be cited?', 'completed',
    array['19000000-0000-4000-8000-000000000021'::uuid],
    timezone('utc', now())
  );

insert into public.messages (
  id, conversation_id, reply_to_message_id, role, content, status,
  answer_kind, model_provider, model_name, completed_at
) values
  (
    '19000000-0000-4000-8000-000000000042',
    '19000000-0000-4000-8000-000000000031',
    '19000000-0000-4000-8000-000000000041',
    'answer', 'Removal keeps this historical Answer.', 'completed',
    'grounded', 'test', 'test-model', timezone('utc', now())
  ),
  (
    '19000000-0000-4000-8000-000000000044',
    '19000000-0000-4000-8000-000000000031',
    '19000000-0000-4000-8000-000000000043',
    'answer', 'This Citation should be rejected.', 'completed',
    'grounded', 'test', 'test-model', timezone('utc', now())
  );

insert into public.citations (
  id, answer_message_id, passage_id, display_order, source_title,
  passage_content, paragraph_start, paragraph_end
) values (
  '19000000-0000-4000-8000-000000000051',
  '19000000-0000-4000-8000-000000000042',
  '19000000-0000-4000-8000-000000000021',
  1, 'Owned Source', 'Grounded removal evidence.', 1, 1
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

select throws_ok(
  $$select * from public.begin_private_source_deletion(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000011'
  )$$,
  '42501',
  'permission denied for function begin_private_source_deletion',
  'A browser Guest cannot invoke privileged Source removal directly'
);

set local role service_role;

select ok(
  has_table_privilege('service_role', 'public.sources', 'select')
    and has_table_privilege('service_role', 'public.sources', 'update')
    and not has_table_privilege('service_role', 'public.sources', 'delete'),
  'Ingestion can read and advance Sources but cannot bypass Source removal'
);

select ok(
  has_table_privilege('service_role', 'public.passages', 'select')
    and has_table_privilege('service_role', 'public.passages', 'insert')
    and has_table_privilege('service_role', 'public.passages', 'update')
    and has_table_privilege('service_role', 'public.passages', 'delete'),
  'Ingestion has the Passage privileges needed for idempotent stages'
);

select throws_ok(
  $$select * from public.begin_private_source_deletion(
    '19222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '19000000-0000-4000-8000-000000000011'
  )$$,
  '42501', 'source_not_authorized',
  'The privileged operation rejects another Guest Source'
);

select throws_ok(
  $$select * from public.begin_private_source_deletion(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '00000000-0000-4000-8000-000000000031'
  )$$,
  '42501', 'source_not_authorized',
  'The privileged operation rejects an Example Source'
);

select lives_ok(
  $$select public.acquire_ingestion_lease(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000011',
    '19000000-0000-4000-8000-000000000061', 1
  )$$,
  'An owned Source can hold an ingestion lease before removal'
);

select is(
  (select count(*)::integer from public.begin_private_source_deletion(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000011'
  )),
  1,
  'The owner begins removal through one atomic operation'
);

reset role;

select is(
  (select processing_stage from public.sources where id = '19000000-0000-4000-8000-000000000011'),
  'deleting',
  'Removal intent is persisted before cleanup'
);

select is(
  (select count(*)::integer from public.ingestion_leases where source_id = '19000000-0000-4000-8000-000000000011'),
  0,
  'Beginning removal releases the ingestion lease'
);

set local role service_role;

select throws_ok(
  $$select public.acquire_ingestion_lease(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000011',
    '19000000-0000-4000-8000-000000000062', 1
  )$$,
  '42501', 'source_not_authorized',
  'A deleting Source cannot restart ingestion'
);

reset role;

select throws_ok(
  $$insert into public.citations (
    answer_message_id, passage_id, display_order, source_title,
    passage_content, paragraph_start, paragraph_end
  ) values (
    '19000000-0000-4000-8000-000000000044',
    '19000000-0000-4000-8000-000000000021',
    1, 'Owned Source', 'Grounded removal evidence.', 1, 1
  )$$,
  '22023', 'citation_unavailable',
  'An Answer cannot complete a Citation against a deleting Source'
);

set local role service_role;

select ok(
  public.complete_private_source_deletion(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000011'
  ),
  'The owner completes database cleanup after Storage cleanup'
);

reset role;

select is(
  (select count(*)::integer from public.sources where id = '19000000-0000-4000-8000-000000000011'),
  0,
  'Completed removal deletes the Source'
);

select is(
  (select count(*)::integer from public.passages where id = '19000000-0000-4000-8000-000000000021'),
  0,
  'Completed removal cascades its Passages'
);

select is(
  (select count(*)::integer from public.citations where id = '19000000-0000-4000-8000-000000000051' and passage_id is null),
  1,
  'Historical Citation snapshots remain and become unavailable'
);

select is(
  (select count(*)::integer from public.messages where id = '19000000-0000-4000-8000-000000000042'),
  1,
  'Historical Answers remain after Source removal'
);

set local role service_role;

select throws_ok(
  $$select public.delete_private_notebook(
    '19222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '19000000-0000-4000-8000-000000000002',
    array['19000000-0000-4000-8000-000000000012'::uuid]
  )$$,
  '42501', 'notebook_not_authorized',
  'Another Guest cannot delete a private Notebook through the privileged operation'
);

select throws_ok(
  $$select public.delete_private_notebook(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '00000000-0000-4000-8000-000000000003',
    array[]::uuid[]
  )$$,
  '42501', 'notebook_not_authorized',
  'The Example Notebook cannot be deleted through the privileged operation'
);

select throws_ok(
  $$select public.delete_private_notebook(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000002',
    array[]::uuid[]
  )$$,
  'P0001', 'notebook_sources_changed',
  'Notebook deletion stops when the cleaned Source set is stale'
);

select ok(
  public.delete_private_notebook(
    '19111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '19000000-0000-4000-8000-000000000002',
    array['19000000-0000-4000-8000-000000000012'::uuid]
  ),
  'Notebook deletion succeeds for the exact cleaned Source set'
);

reset role;

select is(
  (select count(*)::integer from public.notebooks where id = '19000000-0000-4000-8000-000000000002'),
  0,
  'The exact-set operation deletes the private Notebook'
);

select is(
  (select count(*)::integer from public.sources where id = '19000000-0000-4000-8000-000000000012'),
  0,
  'Notebook deletion cascades its cleaned Source records'
);

select * from finish();
rollback;
