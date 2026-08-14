begin;

select plan(8);

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

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

insert into public.notebooks (id, owner_id, title)
values (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Guest A research'
);

select is(
  (select count(*)::integer from public.notebooks),
  1,
  'Guest A can list their Notebook'
);

select lives_ok(
  $$update public.notebooks set title = 'Renamed by A' where id = '11111111-1111-4111-8111-111111111111'$$,
  'Guest A can rename their Notebook'
);

set local request.jwt.claims =
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated","is_anonymous":true}';

select is(
  (select count(*)::integer from public.notebooks),
  0,
  'Guest B cannot read Guest A Notebook'
);

select lives_ok(
  $$update public.notebooks set title = 'Taken by B' where id = '11111111-1111-4111-8111-111111111111'$$,
  'An unauthorized rename reveals no row'
);

select is(
  (select count(*)::integer from public.notebooks where title = 'Taken by B'),
  0,
  'Guest B cannot rename Guest A Notebook'
);

select lives_ok(
  $$delete from public.notebooks where id = '11111111-1111-4111-8111-111111111111'$$,
  'An unauthorized delete reveals no row'
);

set local request.jwt.claims =
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","is_anonymous":true}';

select is(
  (select title from public.notebooks where id = '11111111-1111-4111-8111-111111111111'),
  'Renamed by A',
  'Guest B could neither rename nor delete Guest A Notebook'
);

select throws_ok(
  $$insert into public.notebooks (owner_id, title) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Wrong owner')$$,
  '42501',
  'notebook_owner_mismatch',
  'A Guest cannot create a Notebook for another owner'
);

select * from finish();
rollback;
