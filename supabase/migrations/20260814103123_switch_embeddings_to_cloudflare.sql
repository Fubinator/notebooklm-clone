-- Embeddings from different models or pooling modes do not share a vector
-- space. Existing Source fixtures cannot be relabeled and are removed before
-- the Cloudflare configuration becomes mandatory. Re-running the committed
-- seed recreates them with genuine Cloudflare-generated vectors.

alter table public.sources
  drop constraint sources_embedding_configuration,
  add column embedding_provider text,
  add column embedding_pooling text;

delete from public.sources
where embedding_model in (
  'sentence-transformers/all-MiniLM-L6-v2',
  'all-MiniLM-L6-v2'
);

alter table public.sources
  alter column embedding_provider set not null,
  alter column embedding_pooling set not null,
  add constraint sources_embedding_configuration check (
    embedding_provider = 'cloudflare-workers-ai'
    and embedding_model = '@cf/baai/bge-small-en-v1.5'
    and embedding_dimensions = 384
    and embedding_pooling = 'cls'
  );
