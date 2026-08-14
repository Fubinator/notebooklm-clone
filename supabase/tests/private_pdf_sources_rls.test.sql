begin;

select plan(6);

select is(
  (select storage_path from public.sources where id = '00000000-0000-4000-8000-000000000031'),
  null::text,
  'A ready attributed Example PDF does not require a private original object'
);

insert into auth.users (id, instance_id, aud, role, is_anonymous)
values
  ('abababab-abab-4bab-8bab-abababababab', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true);

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"abababab-abab-4bab-8bab-abababababab","role":"authenticated","is_anonymous":true}';
set local request.jwt.claim.sub = 'abababab-abab-4bab-8bab-abababababab';

insert into public.notebooks (id, owner_id, title)
values ('60000000-0000-4000-8000-000000000001', 'abababab-abab-4bab-8bab-abababababab', 'Private PDF research');

reset role;

insert into public.sources (
  id, notebook_id, title, kind, attribution, license_name, license_url, content,
  storage_path, processing_stage, embedding_provider, embedding_model,
  embedding_dimensions, embedding_pooling
) values (
  '60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000001',
  'Private paper', 'pdf', 'Added by this Guest', 'Private Source', '', '',
  'abababab-abab-4bab-8bab-abababababab/60000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002/original.pdf',
  'uploaded', 'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls'
);

select throws_ok(
  $$
    insert into public.sources (
      notebook_id, title, kind, attribution, license_name, license_url, content,
      processing_stage, embedding_provider, embedding_model, embedding_dimensions, embedding_pooling
    ) values (
      '60000000-0000-4000-8000-000000000001', 'Missing original', 'pdf',
      'Added by this Guest', 'Private Source', '', '', 'uploaded',
      'cloudflare-workers-ai', '@cf/baai/bge-small-en-v1.5', 384, 'cls'
    )
  $$,
  '23514',
  'new row for relation "sources" violates check constraint "sources_pdf_storage"',
  'A private uploaded PDF still requires a Storage path'
);

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'source-files',
  'abababab-abab-4bab-8bab-abababababab/60000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002/original.pdf',
  'abababab-abab-4bab-8bab-abababababab',
  '{"mimetype":"application/pdf"}'
);

set local role authenticated;
set local request.jwt.claim.sub = 'abababab-abab-4bab-8bab-abababababab';
select is((select count(*)::integer from storage.objects where bucket_id = 'source-files'), 1, 'The owning Guest can read the private original PDF');
select lives_ok(
  $$update storage.objects set metadata = metadata || '{"rls_test":"owner"}'::jsonb where bucket_id = 'source-files'$$,
  'The owning Guest can mutate their private original PDF metadata'
);

set local request.jwt.claims =
  '{"sub":"cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd","role":"authenticated","is_anonymous":true}';
set local request.jwt.claim.sub = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd';
select is((select count(*)::integer from storage.objects where bucket_id = 'source-files'), 0, 'Another Guest cannot read the private original PDF');
update storage.objects
set metadata = metadata || '{"rls_test":"other"}'::jsonb
where bucket_id = 'source-files';

reset role;
select is(
  (select metadata ->> 'rls_test' from storage.objects where bucket_id = 'source-files'),
  'owner',
  'Another Guest cannot mutate the private original PDF metadata'
);

select * from finish();
rollback;
