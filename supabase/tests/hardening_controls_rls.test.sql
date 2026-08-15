begin;

select plan(13);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true),
  ('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);

set local role service_role;

create temporary table guest_a_notebook as
select id from public.create_private_notebook(
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Guest A', 1
);

select is(
  (select count(*)::integer from guest_a_notebook),
  1,
  'The privileged Notebook operation creates one owned Notebook'
);
select throws_ok(
  $$select * from public.create_private_notebook('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Too many', 1)$$,
  'P0001', 'notebook_limit_reached',
  'The atomic Notebook operation enforces its configured limit'
);
select is(
  (select count(*)::integer from public.create_private_notebook('22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Guest B', 1)),
  1,
  'A second Guest has an independent Notebook allowance'
);

select is(
  (select count(*)::integer from public.create_private_source(
    '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    (select id from guest_a_notebook),
    'Owned Source', 'pasted_text', 'Grounded evidence.', null, 1,
    'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls'
  )),
  1,
  'The privileged Source operation rechecks Notebook ownership'
);
select throws_ok(
  $$select * from public.create_private_source(
    '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    (select id from guest_a_notebook),
    'Too many', 'pasted_text', 'More evidence.', null, 1,
    'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls'
  )$$,
  'P0001', 'source_limit_reached',
  'The atomic Source operation enforces its configured limit'
);
select throws_ok(
  $$select * from public.create_private_source(
    '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000003',
    (select id from guest_a_notebook),
    'Intrusion', 'pasted_text', 'Stolen.', null, 5,
    'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls'
  )$$,
  '42501', 'notebook_not_authorized',
  'A privileged Source operation rejects another Guest Notebook'
);

select lives_ok(
  $$select public.acquire_ingestion_lease(
    '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000010', 1
  )$$,
  'Guest A acquires one ingestion lease'
);
select lives_ok(
  $$select public.renew_ingestion_lease(
    '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000010'
  )$$,
  'The owner heartbeat keeps an active ingestion lease valid'
);
select throws_ok(
  $$select public.renew_ingestion_lease(
    '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000010'
  )$$,
  '42501', 'ingestion_lease_not_owned',
  'Another Guest cannot renew the ingestion lease'
);

reset role;
insert into public.conversations (id, notebook_id, owner_id)
values (
  '10000000-0000-4000-8000-000000000020',
  (select id from guest_a_notebook),
  '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);
insert into public.messages (id, conversation_id, role, content, status, completed_at)
values (
  '10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000020',
  'question', 'Can this be answered?', 'completed', timezone('utc', now())
);
insert into public.messages (
  id, conversation_id, reply_to_message_id, role, content, status, answer_kind,
  model_provider, model_name, completed_at
) values (
  '10000000-0000-4000-8000-000000000022',
  '10000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000021', 'answer',
  'The Sources are insufficient.', 'completed', 'insufficient_evidence',
  'cloudflare-workers-ai', '@cf/example/model', timezone('utc', now())
);

set local role service_role;
select lives_ok(
  $$select public.record_model_usage(
    '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000022',
    'cloudflare-workers-ai', '@cf/example/model'
  )$$,
  'A completed provider-backed insufficient Answer records usage'
);
select throws_ok(
  $$select public.record_model_usage(
    '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000022',
    'cloudflare-workers-ai', '@cf/example/model'
  )$$,
  '42501', 'answer_not_authorized',
  'Another Guest cannot manufacture usage for the Answer'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';
select is((select count(*)::integer from public.model_usage), 1, 'Guest A reads their usage record');
set local request.jwt.claims =
  '{"sub":"22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';
select is((select count(*)::integer from public.model_usage), 0, 'Guest B cannot read Guest A usage');

select * from finish();
rollback;
