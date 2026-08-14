begin;

select plan(21);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    true
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    true
  );

select is(
  (select count(*)::integer from public.passages where extensions.vector_dims(embedding) = 384),
  6,
  'Every seeded Passage has a 384-dimension embedding'
);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

select is(
  (select title from public.notebooks where is_example),
  'Building Trustworthy AI',
  'A fresh authenticated Guest can read the Example Notebook'
);

select is(
  (select count(*)::integer from public.sources),
  2,
  'The Example Notebook has two attributed Sources'
);

select is(
  (select count(*)::integer from public.passages),
  6,
  'The Example Sources expose their seeded Passages'
);

select is(
  (
    select count(*)::integer
    from public.sources
    where processing_stage = 'ready'
      and embedding_provider = 'cloudflare-workers-ai'
      and embedding_model = '@cf/baai/bge-small-en-v1.5'
      and embedding_dimensions = 384
      and embedding_pooling = 'cls'
  ),
  2,
  'Every Example Source is ready with one embedding configuration'
);

select is(
  (select count(*)::integer from public.passages where page_number is not null),
  6,
  'Every seeded Passage retains its PDF page location'
);

insert into public.notebooks (id, owner_id, title)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Guest A research'
);

select is(
  (select count(*)::integer from public.notebooks),
  2,
  'Guest A sees the shared Example and their private Notebook'
);

select lives_ok(
  $$update public.notebooks set title = 'Renamed by A' where id = '11111111-1111-4111-8111-111111111111'$$,
  'Guest A can rename their private Notebook'
);

set local request.jwt.claims =
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';

select is(
  (select count(*)::integer from public.notebooks),
  1,
  'Guest B sees the Example but not Guest A private Notebook'
);

select is(
  (select count(*)::integer from public.notebooks where owner_id is not null),
  0,
  'Guest B cannot read Guest A private Notebook'
);

select is(
  (select count(*)::integer from public.sources),
  2,
  'A second Guest can read the Example Sources'
);

select is(
  (select count(*)::integer from public.passages),
  6,
  'A second Guest can read the Example Passages'
);

select lives_ok(
  $$update public.notebooks set title = 'Changed example' where is_example$$,
  'An Example Notebook rename reveals no mutable row'
);

select is(
  (select title from public.notebooks where is_example),
  'Building Trustworthy AI',
  'A Guest cannot rename the Example Notebook'
);

select lives_ok(
  $$delete from public.notebooks where is_example$$,
  'An Example Notebook delete reveals no mutable row'
);

select is(
  (select count(*)::integer from public.notebooks where is_example),
  1,
  'A Guest cannot delete the Example Notebook'
);

select throws_ok(
  $$insert into public.sources (notebook_id, title, kind, attribution, license_name, license_url, content, embedding_provider, embedding_model, embedding_dimensions, embedding_pooling) values ('00000000-0000-4000-8000-000000000003', 'Injected', 'pasted_text', 'Guest B', 'None', 'https://example.com', 'Injected', 'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls')$$,
  '42501',
  'permission denied for table sources',
  'Guests cannot create Example Sources'
);

select throws_ok(
  $$update public.sources set title = 'Changed Source' where notebook_id = '00000000-0000-4000-8000-000000000003'$$,
  '42501',
  'permission denied for table sources',
  'Guests cannot update Example Sources'
);

select lives_ok(
  $$update public.notebooks set title = 'Taken by B' where id = '11111111-1111-4111-8111-111111111111'$$,
  'An unauthorized private rename reveals no row'
);

set local request.jwt.claims =
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

select is(
  (select title from public.notebooks where id = '11111111-1111-4111-8111-111111111111'),
  'Renamed by A',
  'Guest B could not rename Guest A private Notebook'
);

select throws_ok(
  $$insert into public.notebooks (owner_id, title) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Wrong owner')$$,
  '42501',
  'notebook_owner_mismatch',
  'A Guest cannot create a Notebook for another owner'
);

select * from finish();
rollback;
