alter table public.sources
  add column storage_path text,
  drop constraint sources_content_present,
  add constraint sources_content_present check (
    (kind = 'pdf' and (content = '' or char_length(btrim(content)) > 0))
    or (kind <> 'pdf' and char_length(btrim(content)) > 0)
  ),
  add constraint sources_pdf_storage check (
    (
      kind = 'pdf'
      and (
        storage_path is not null
        or (processing_stage = 'ready' and original_url is not null)
      )
    )
    or (kind <> 'pdf' and storage_path is null)
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('source-files', 'source-files', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Guests read owned Source files"
on storage.objects for select to authenticated
using (
  bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.sources
    join public.notebooks on notebooks.id = sources.notebook_id
    where sources.storage_path = name
      and notebooks.owner_id = (select auth.uid())
      and not notebooks.is_example
  )
);

create policy "Guests mutate owned Source files"
on storage.objects for update to authenticated
using (
  bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.sources
    join public.notebooks on notebooks.id = sources.notebook_id
    where sources.storage_path = name
      and notebooks.owner_id = (select auth.uid())
      and not notebooks.is_example
  )
)
with check (bucket_id = 'source-files' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "Guests delete owned Source files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'source-files'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1 from public.sources
    join public.notebooks on notebooks.id = sources.notebook_id
    where sources.storage_path = name
      and notebooks.owner_id = (select auth.uid())
      and not notebooks.is_example
  )
);

comment on column public.sources.storage_path is
  'Private Storage object path for an original uploaded PDF.';
