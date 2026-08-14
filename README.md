# NotebookLM-Clone

NotebookLM-Clone is a private, source-grounded research workspace built for a focused full-stack interview demonstration. The product uses the original interface name **Margin** and does not claim affiliation with Google.

This first vertical slice creates or restores a Supabase-authenticated Guest without an application login form. A Guest can create, list, open, rename, and delete private Notebooks in a responsive three-pane research desk. Supabase Row Level Security—not UI filtering—enforces ownership.

## What works

- Automatic Supabase anonymous sign-in with cookie-backed session restoration
- Dynamically rendered identity-bearing pages to prevent Guest metadata caching
- Private Notebook create, list, open, rename, and delete behavior
- Database-enforced ownership, title constraints, and five-Notebook Guest limit
- Desktop three-pane Sources, Conversation, and Studio shell
- Purposeful unconfigured, loading, empty, disabled, error, and success states
- Narrow-screen panel navigation
- Focused domain/UI tests and a two-Guest RLS authorization test
- CI checks for formatting, linting, TypeScript, tests, production build, and RLS

Sources, grounded Answers, Citations, and Notes are represented by intentional empty states; their behavior belongs to later vertical slices.

## Stack

- Next.js 16 and React 19
- TypeScript and Tailwind CSS 4
- shadcn/ui-style primitives backed by Radix UI
- Supabase Auth and Postgres with Row Level Security
- Vitest, Testing Library, and pgTAP
- Vercel deployment

## Setup

### Prerequisites

- Node.js 24+
- npm 11+
- A Supabase project, or Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) for local services

### 1. Install dependencies

```bash
npm ci
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

Set only these browser-safe values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_local_publishable_key
```

For a hosted project:

1. Open **Authentication → Sign In / Providers → Anonymous Sign-Ins** and enable anonymous sign-ins.
2. Link the CLI with `supabase link --project-ref <project-ref>`.
3. Apply the migration with `supabase db push`.
4. Copy the Project URL and publishable key from the project’s **Connect** dialog into `.env.local`.

Do not add a service-role or secret key. This slice performs ordinary Notebook CRUD as the authenticated Guest under RLS.

### 3. Run the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A fresh browser creates a Guest automatically; refreshing restores that Guest from the Supabase SSR cookies.

## Verification

Run the application checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

With the local Supabase stack running, verify database authorization:

```bash
supabase test db
```

The pgTAP test assumes two independent authenticated Guests and proves that one Guest cannot list, rename, or delete the other Guest’s Notebook. The migration also rejects inserting a Notebook for another owner.

## Vercel preview

1. Import this repository into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the Preview environment.
3. Add the preview URL to Supabase Auth’s allowed redirect URLs.
4. Deploy the branch and smoke-test it in a private browser window.
5. In Vercel, enable Deployment Protection for preview deployments and create a shareable link for the reviewer.
6. Keep that private shareable URL outside the public repository. Use a separate deployment-protection bypass secret if automated browser tests are added later.

The Vercel gate controls who can reach the preview; Supabase RLS continues to isolate every admitted Guest’s data. Revoke or rotate the shareable link after review.

## Security notes

- `src/app/page.tsx` explicitly forces dynamic rendering and disables revalidation.
- Supabase access and refresh tokens are stored in SSR-compatible cookies and refreshed by `src/proxy.ts`.
- The browser receives only a publishable Supabase key. No privileged key is required or referenced.
- Every exposed Notebook operation is constrained to `auth.uid() = owner_id` in the database.
- Unauthenticated requests receive no Notebook table privileges.
- `.env*` files are ignored except for the credential-free `.env.example` template.

Anonymous Guests lose access if their browser storage is cleared or they sign out. That is expected for this demonstration scope.

## Project guide

- [Product scope](./PRODUCT.md)
- [Architecture](./ARCHITECTURE.md)
- [Domain language](./CONTEXT.md)
- [Delivery and walkthrough plan](./DEMO.md)
- [Notebook migration](./supabase/migrations/20260814000000_create_notebooks.sql)
- [RLS authorization test](./supabase/tests/notebooks_rls.test.sql)
