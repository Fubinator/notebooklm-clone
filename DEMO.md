# NotebookLM-Clone Delivery and Loom Plan

The submission consists of a public GitHub repository, a live protected Vercel preview, and a Loom walkthrough under 10 minutes. The target recording length is 6–7 minutes.

## Reviewer handoff

Provide three separate links:

1. Public GitHub repository
2. Protected Vercel preview using its private shareable URL
3. Loom recording

The private shareable URL is the reviewer's access credential. Do not publish it in the public repository. Verify it in a fresh private browser window before submission.

## Deployment checklist

### Repository

- [ ] Repository visibility is public.
- [ ] README leads with the product outcome, screenshot, live-demo access instructions, and Loom link.
- [ ] README labels the project as independently built and NotebookLM-inspired.
- [ ] Setup instructions work from a clean checkout.
- [ ] `.env.example` contains variable names and explanations but no secrets.
- [ ] Supabase migrations and Example Notebook seed are reproducible.
- [ ] Architecture and scope documents match the shipped behavior.
- [ ] License choice and any third-party Source attribution are explicit.
- [ ] Default branch CI is green.

### Vercel and Supabase

- [ ] Environment variables are configured separately for preview and local development.
- [ ] The submitted preview is protected and the shareable URL works without project membership.
- [ ] The production domain is not accidentally presented as the protected review URL.
- [ ] Automation uses its own protection-bypass secret.
- [ ] Supabase anonymous sign-in is enabled.
- [ ] All exposed tables and Storage objects have verified RLS policies.
- [ ] A two-browser isolation check proves Guests cannot see one another's private data.
- [ ] Provider and application usage ceilings are active.
- [ ] Logs exclude Source, Passage, prompt, Answer, credential, and token contents.

### Product smoke test

- [ ] A new private browser receives a Guest identity without a login form.
- [ ] The Example Notebook loads with ready Sources and suggested Questions.
- [ ] A known Question produces a grounded Answer.
- [ ] Every displayed Citation opens the intended Passage and location.
- [ ] An unrelated Question produces an insufficient-evidence response.
- [ ] Saving an Answer creates a private Note.
- [ ] A new Notebook accepts a small PDF and pasted Source.
- [ ] Processing Stages survive a refresh and failed work can be retried.
- [ ] Limits are shown before upload and Question submission.
- [ ] The main desktop layout and narrow-screen drawers are usable.

## Loom narrative

### 0:00–0:35 — Frame the problem

- Introduce NotebookLM-Clone as a narrow source-grounded research workspace.
- State the design goal: trustworthy answers with evidence that can be inspected.
- Mention the one-week constraint and deliberate non-goal of NotebookLM feature parity.

### 0:35–1:15 — Enter without friction

- Open the protected preview using the reviewer link.
- Show the Example Notebook appearing without an application login form.
- Orient the viewer to Sources, Conversation, and the contextual right panel.

### 1:15–2:50 — Demonstrate the hero interaction

- Ask one prepared Question that requires comparing at least two Sources.
- Let the Answer stream if the final implementation supports safe streaming.
- Open two Citations and show their exact Passages and locations.
- Ask one deliberately unsupported Question and show the insufficient-evidence behavior.

### 2:50–4:05 — Demonstrate ingestion

- Create a new Notebook.
- Upload a short PDF or add prepared pasted text.
- Show the persisted Processing Stages and explain that they are idempotent and retryable.
- Use a preprocessed Source if waiting would make the recording drag.

### 4:05–4:45 — Demonstrate persistence

- Save an Answer as a Note.
- Refresh and show that the Conversation and Note remain.
- Briefly mention that another Guest receives isolated data through RLS.

### 4:45–5:50 — Show engineering depth

- Use one architecture diagram rather than touring every folder.
- Trace Source ingestion through extraction, Passage creation, embeddings, and pgvector retrieval.
- Explain that model-produced Citation IDs are checked against retrieved Passages before persistence.
- Call out the provider seam, server-only privileged work, and content-free structured logs.

### 5:50–6:30 — Show verification

- Show green CI and the focused test groups.
- Highlight the two-Guest RLS test and five-Question retrieval evaluation.
- Avoid scrolling through test source unless one compact assertion clarifies the design.

### 6:30–7:00 — Close with judgment

- Restate the core outcome and the strongest engineering signals.
- Name the deliberate exclusions: broad ingestion, multiple threads, audio, and collaboration.
- Mention the first credible next step, such as permanent account upgrade or background ingestion.

## Prepared demo material

Generate the project-authored ingestion fixture before rehearsing:

```bash
pnpm demo:prepare
```

Use these exact materials:

- Multi-Source comparison Question: **How do the AI RMF's lifecycle functions and the Generative AI Profile's recommendations work together to reduce the risk of confident false answers?**
- Precise single-Passage Question: **What four functions make up the AI RMF Core?** (expected location: AI RMF 1.0, PDF page 20)
- Unsupported Question: **What is the capital of France?** (expected result: insufficient evidence, with no model call)
- Known-good PDF: `demo/known-good-source.pdf`, generated deterministically by `pnpm demo:prepare`
- Pasted-text fallback: `demo/pasted-text-fallback.md`
- One already processed private Notebook in case a provider is temporarily slow

The final Example Notebook contains two legally reusable, attributed NIST technical Sources about building trustworthy AI applications. Their DOI, authorship, and NIST Technical Series reuse terms appear in the Source inspector and committed seed.

## Recording rules

- Record at a desktop viewport where all three panes are readable.
- Use a clean browser profile with no unrelated bookmarks, tabs, extensions, or notifications.
- Increase the pointer size or enable a subtle click indicator if Citations are difficult to follow.
- Keep secrets, provider dashboards, environment values, and reviewer-only URL parameters off-screen.
- Prefer a rehearsed continuous take; edit only dead time, credentials, or accidental exposure.
- Do not spend time narrating routine framework setup or every UI primitive.
- Do not claim production scale. Explain the current envelope and the next architecture step honestly.
- Stop before 7:30 to preserve margin below the 10-minute limit.

## Signal map

| Reviewer sees | Engineering signal |
| --- | --- |
| Immediate Example Notebook | Product judgment and demo reliability |
| Visible retryable Processing Stages | Durable workflow and failure design |
| Grounded Answer with inspectable Citations | AI orchestration and trustworthiness |
| Private Conversation after refresh | Persistence and ownership modeling |
| Two-Guest isolation test | Database authorization and security |
| Retrieval evaluation | AI quality measured beyond exact prose tests |
| Clear exclusions and next steps | Scope control and architectural judgment |

## Final submission check

- [ ] GitHub, Vercel, and Loom links open from a signed-out or private browser as intended.
- [ ] The reviewer has the complete private shareable URL outside the public repository.
- [ ] The deployed commit matches the default branch and the commit shown in the Loom.
- [ ] The AI and embedding providers have sufficient remaining quota for review.
- [ ] The Example Notebook still answers all prepared Questions with valid Citations.
- [ ] The recording is under 10 minutes, readable at normal playback speed, and has working sharing permissions.
- [ ] No secret, private URL parameter, personal notification, or unrelated account data appears in the recording.
