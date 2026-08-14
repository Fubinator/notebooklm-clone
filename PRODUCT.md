# NotebookLM-Clone Product Scope

Status: confirmed planning baseline

NotebookLM-Clone is an independently built, NotebookLM-inspired interview project. It uses its own visual treatment and does not claim affiliation with Google.

## Outcome

Demonstrate full-stack product engineering through one narrow, trustworthy workflow:

> A guest opens a notebook, adds a small set of sources, asks a question, receives an answer grounded in those sources, and inspects the exact evidence behind each citation.

The project is judged as a finished product rather than a feature-count exercise. The working delivery budget is 15–20 focused hours inside a one-week deadline, with protected time for testing, deployment, documentation, and recording.

## Audience

The product user is a person researching a small collection of documents. The evaluation audience is a full-stack engineering interviewer looking for evidence of:

- Product judgment and deliberate scope
- End-to-end data flow and ownership
- Trustworthy AI integration
- Clear failure behavior
- Frontend interaction quality
- Testing, security, deployment, and operational awareness

## Core journey

1. The reviewer opens a protected Vercel preview through a privately supplied shareable link.
2. The application creates or restores a Guest without asking for personal information.
3. The reviewer explores the Example Notebook immediately.
4. The reviewer asks a suggested or original Question.
5. The application retrieves relevant Passages and produces a grounded Answer.
6. The reviewer opens a Citation to inspect the supporting Passage and its PDF page or pasted-text paragraph.
7. The reviewer may save the Answer as a Note.
8. The reviewer may create a Notebook, add a PDF or pasted Source, observe its Processing Stages, and question it when ready.

## Committed scope

### Entry and ownership

- No application login wall
- Automatic Supabase anonymous authentication
- A shared, read-only Example Notebook with private per-Guest Conversation and Notes
- Private Guest-created Notebooks, Sources, Conversations, and Notes
- Ownership enforced by Supabase Row Level Security, not only by UI checks

### Notebooks and sources

- Create, list, rename, and delete Notebooks
- Add multiple Sources to a Notebook
- PDF upload and pasted-text input
- Persisted, visible Processing Stages with retryable failures
- Source list and readable Source preview
- One upload processed at a time per Guest

### Grounded conversation

- One persistent Conversation per Guest per Notebook
- Suggested starter Questions
- Semantic retrieval across ready Sources in the current Notebook
- Answers constrained to retrieved Passages
- Validated Citations that reference only Passages used for the Answer
- Citation inspection showing the exact Passage and its Source location
- An explicit insufficient-evidence response when the Sources do not support an Answer
- Streaming Answers when it can be implemented without weakening Citation integrity

### Notes and polish

- Save an Answer as a Note
- Desktop-first three-pane layout: Sources, Conversation, and contextual Passage or Notes
- Side panels become drawers on smaller screens
- Intentional empty, loading, success, disabled, and error states
- Original visual treatment built with Tailwind CSS and shadcn/ui

### Delivery quality

- Public GitHub repository with reproducible setup and no committed secrets
- Live Vercel preview protected outside application code
- Unit, integration, browser-level, and small retrieval-evaluation coverage
- Green CI for formatting, linting, type checking, tests, and the production build
- A polished Loom walkthrough targeting 6–7 minutes and remaining under 10 minutes

## Product rules

- An Answer must not cite a Passage that was not retrieved for its Question.
- An Answer without adequate supporting Passages must say that the Sources are insufficient.
- Source text is untrusted content, never an instruction to the model or application.
- A failed or partially streamed Answer is not persisted as a successful Answer.
- Example Notebook Sources are immutable to Guests.
- Each Guest sees only their own Conversation and Notes in the Example Notebook.
- A Source is unavailable for Questions until its Processing Stage is `ready`.
- Limits are visible before a Guest attempts the constrained action.

## Demo limits

| Resource | Limit |
| --- | ---: |
| Notebooks per Guest | 5 |
| Sources per Notebook | 5 |
| PDF size | 10 MB |
| PDF length | 50 pages |
| Pasted Source length | 50,000 characters |
| Concurrent ingestion per Guest | 1 Source |
| AI Questions per Guest per day | 20 |

These values must be environment-configurable. Deployment-level and model-provider budgets provide a separate global ceiling.

## Explicit non-goals

- NotebookLM feature parity
- Audio or podcast generation
- Flashcards, quizzes, study guides, or other generated artifacts
- Website, YouTube, Google Drive, or general office-document ingestion
- Multiple Conversations within a Notebook
- Collaboration, comments, sharing, or team workspaces
- Export, browser extensions, or mobile applications
- Multi-provider switching in the product
- A durable background queue in the committed build
- Production-scale vector-index tuning

## Scope cut order

If delivery slips, remove features in this order:

1. Answer streaming
2. Suggested Questions
3. Saved Notes
4. Notebook rename/delete polish
5. Pasted-text input

Do not cut Source upload, private ownership, grounded retrieval, Citation validation, Passage inspection, failure states, deployment, or the principal tests.

## Stretch order

If the committed scope is finished and verified early, invest in:

1. Accessibility and interaction polish
2. Retrieval-evaluation improvements
3. Upgrading a Guest to a permanent login
4. An automatic Notebook overview
5. Background ingestion
6. Additional Source formats

Audio, collaboration, and study-generation features remain out of scope for this delivery even if time remains.

## Definition of done

The project is complete only when:

- The public repository contains setup instructions, migrations, configuration examples, tests, and these planning documents.
- A fresh browser can use the privately shared Vercel link, receive an isolated Guest identity, and explore the Example Notebook.
- A Guest can ingest a supported Source, refresh during processing, and either reach `ready` or see a retryable failure.
- A grounded Question produces an Answer whose Citations open the correct stored Passages.
- Ownership policies prevent one Guest from reading or mutating another Guest's private data.
- Required checks pass in CI and the deployed happy path has been verified.
- The final Loom is under 10 minutes and includes the product, architecture, tests, and explicit tradeoffs.

Implementation details and unresolved setup choices are tracked in [ARCHITECTURE.md](./ARCHITECTURE.md). The submission narrative is in [DEMO.md](./DEMO.md).
