# NotebookLM-Clone

NotebookLM-Clone is a private, source-grounded research workspace built for a focused full-stack interview demonstration. The product uses the original interface name **Margin** and does not claim affiliation with Google.

The application creates or restores a Supabase-authenticated Guest without an application login form. Every Guest can immediately explore a shared, read-only Example Notebook, while creating and managing private Notebooks in the same responsive three-pane research desk. Supabase Row Level Security—not UI filtering—enforces both shared access and private ownership.

## What works

- Automatic Supabase anonymous sign-in with cookie-backed session restoration
- Dynamically rendered identity-bearing pages to prevent Guest metadata caching
- Private Notebook create, list, open, rename, and delete behavior
- Immediate shared Example Notebook with two attributed NIST Sources
- Readable Source previews with ordered PDF-page Passages
- Reproducible 384-dimension Cloudflare Workers AI embeddings stored with pgvector
- Private persistent Conversation per Guest and Notebook
- Notebook-scoped Retrieval across ready Sources only
- Grounded Cloudflare Answers with machine-readable, validated Passage Citations
- One repair attempt for invalid Citation output and safe failure after that
- Explicit insufficient-evidence Answers without a chat-model call
- Citation inspection with the exact Passage, Source title, and PDF page or paragraph
- Database-enforced immutability for Example Notebook data
- Database-enforced ownership, title constraints, and five-Notebook Guest limit
- Desktop three-pane Sources, Conversation, and Studio shell
- Purposeful unconfigured, loading, empty, disabled, error, and success states
- Narrow-screen panel navigation
- Focused orchestration/UI tests, a five-Question retrieval fixture, and two-Guest RLS tests
- CI checks for formatting, linting, TypeScript, tests, production build, and RLS

Private Source ingestion and Notes belong to later vertical slices. The Example Notebook now supports the complete ask → retrieve → answer → inspect journey.

## Stack

- Next.js 16 and React 19
- TypeScript and Tailwind CSS 4
- shadcn/ui-style primitives backed by Radix UI
- Supabase Auth and Postgres with Row Level Security
- pgvector and Cloudflare Workers AI for embeddings and grounded chat
- Vitest, Testing Library, and pgTAP
- Vercel deployment

## Setup

### Prerequisites

- Node.js 24+
- pnpm 10.33+
- A Supabase project, or Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) for local services

### 1. Install dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Configure Supabase

For a local Supabase stack:

```bash
supabase start
supabase db reset
```

The committed `supabase/config.toml` enables anonymous sign-ins locally. Copy the API URL and publishable key printed by `supabase status` into a local environment file:

```bash
cp .env.example .env.local
```

Set the browser-safe Supabase values and the server-only Cloudflare credentials:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_local_publishable_key
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_read_token
CLOUDFLARE_CHAT_MODEL=@cf/meta/llama-3.1-8b-instruct-fast
RETRIEVAL_MATCH_COUNT=5
RETRIEVAL_MIN_SIMILARITY=0.42
```

`supabase db reset` replays the migrations and committed `supabase/seed.sql`, producing the same Example Notebook, Sources, Passages, and embeddings every time.

For a hosted project:

1. Open **Authentication → Sign In / Providers → Anonymous Sign-Ins** and enable anonymous sign-ins.
2. Link the CLI with `supabase link --project-ref <project-ref>`.
3. Apply the migrations and Example seed with `supabase db push --include-seed` on the fresh preview project.
4. Copy the Project URL and publishable key from the project’s **Connect** dialog into `.env.local`.

Do not add a Supabase service-role key. Ordinary reads and Notebook CRUD run as the authenticated Guest under RLS. Restrict the Cloudflare token to `Workers AI Read` on the selected account and keep both Cloudflare values server-only.

### Model providers

The configured embedding provider is Cloudflare Workers AI using `@cf/baai/bge-small-en-v1.5`, 384 dimensions, and `cls` pooling. The model, dimension, and pooling mode form one vector space and must change together. Grounded Answering uses Cloudflare Workers AI with the server-only `CLOUDFLARE_CHAT_MODEL` selection, defaulting to `@cf/meta/llama-3.1-8b-instruct-fast`.

The committed Example seed already contains its vectors, so Cloudflare is not called while browsing the Example Notebook. To deliberately regenerate those vectors after changing the fixture text or embedding configuration, run:

```bash
pnpm seed:example
```

The command loads `.env.local`, validates all six Cloudflare vectors, and only then replaces `supabase/seed.sql`.

The corpus contains excerpts from NIST AI 100-1 and NIST AI 600-1. Each Source displays its authors, DOI, and NIST Technical Series reuse terms; every excerpt retains its printed PDF page.

The Example Passages include committed Cloudflare-generated fixture vectors so local resets do not depend on a live model request. Question Retrieval uses the same server-only embedding adapter. Cloudflare JSON Mode is buffered because it does not support streaming; the application favors final Citation validation and never persists provisional text as a completed Answer.

### 3. Run the application

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). A fresh browser creates a Guest automatically; refreshing restores that Guest from the Supabase SSR cookies.

## Verification

Run the application checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

With the local Supabase stack running, verify database authorization:

```bash
supabase test db
```

The pgTAP suites prove the seed shape and embedding dimensions, evaluate five deterministic retrieval fixtures, reject unready and unauthorized candidates, enforce atomic Citation validation, deny Example mutations, and isolate two Guests' Conversations, Messages, and Citations.

## Vercel preview

1. Import this repository into Vercel.
2. Add the variables shown in `.env.example` to the Preview environment. Only the two `NEXT_PUBLIC_` values are browser-safe; keep every Cloudflare and Retrieval value server-only.
3. Add the preview URL to Supabase Auth’s allowed redirect URLs.
4. Deploy the branch and smoke-test it in a private browser window.
5. In Vercel, enable Deployment Protection for preview deployments and create a shareable link for the reviewer.
6. Keep that private shareable URL outside the public repository. Use a separate deployment-protection bypass secret if automated browser tests are added later.

The Vercel gate controls who can reach the preview; Supabase RLS continues to isolate every admitted Guest’s data. Revoke or rotate the shareable link after review.

## Security notes

- `src/app/page.tsx` explicitly forces dynamic rendering and disables revalidation.
- Supabase access and refresh tokens are stored in SSR-compatible cookies and refreshed by `src/proxy.ts`.
- The browser receives only a publishable Supabase key. No privileged key is required or referenced.
- Private Notebook mutations are constrained to `auth.uid() = owner_id`; Example records have no owner and no Guest mutation policy.
- Authenticated Guests receive SELECT-only access to Source content and location metadata; Passage embeddings are not granted to the browser.
- Grounded Answering records the retrieved evidence set before generation; both TypeScript and Postgres reject a model Citation outside it.
- Questions persist before provider work, while an interrupted or unverifiable Answer remains `pending` or `failed` and never appears complete.
- Model credentials and raw embeddings remain inside server-only modules and the POST Route Handler.
- Unauthenticated requests receive no Notebook table privileges.
- `.env*` files are ignored except for the credential-free `.env.example` template.

Anonymous Guests lose access if their browser storage is cleared or they sign out. That is expected for this demonstration scope.

## Project guide

- [Product scope](./PRODUCT.md)
- [Architecture](./ARCHITECTURE.md)
- [Domain language](./CONTEXT.md)
- [Delivery and walkthrough plan](./DEMO.md)
- [Notebook migration](./supabase/migrations/20260814000000_create_notebooks.sql)
- [Example Source migration](./supabase/migrations/20260814010000_create_example_sources.sql)
- [Grounded Conversation migration](./supabase/migrations/20260814020000_create_grounded_conversations.sql)
- [Reproducible Example seed](./supabase/seed.sql)
- [Notebook and Source RLS test](./supabase/tests/notebooks_rls.test.sql)
- [Grounded Conversation RLS test](./supabase/tests/grounded_conversations_rls.test.sql)
