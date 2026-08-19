import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationMessage } from "@/features/conversations/model";
import type { Notebook } from "@/features/notebooks/model";
import type { ReadableSource } from "@/features/sources/model";
import { DEFAULT_APPLICATION_LIMITS } from "@/lib/limits";

import { NotebookWorkspace } from "./notebook-workspace";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  sourceList: vi.fn(),
  sourceCreate: vi.fn(),
  sourceAdvance: vi.fn(),
  sourceRemove: vi.fn(),
  conversationList: vi.fn(),
  askQuestion: vi.fn(),
  noteList: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  removeNote: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/features/notebooks/repository", () => ({
  createNotebookRepository: () => ({
    create: mocks.create,
    rename: mocks.rename,
    remove: mocks.remove,
  }),
}));

vi.mock("@/features/sources/repository", () => ({
  createSourceRepository: () => ({
    list: mocks.sourceList,
    create: mocks.sourceCreate,
    advance: mocks.sourceAdvance,
    remove: mocks.sourceRemove,
  }),
}));

vi.mock("@/features/conversations/repository", () => ({
  createConversationRepository: () => ({
    list: mocks.conversationList,
    ask: mocks.askQuestion,
  }),
}));

vi.mock("@/features/notes/repository", () => ({
  createNoteRepository: () => ({
    list: mocks.noteList,
    saveAnswer: mocks.createNote,
    update: mocks.updateNote,
    remove: mocks.removeNote,
  }),
}));

const first: Notebook = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  is_example: false,
  title: "Trustworthy AI",
  created_at: "2026-08-14T09:00:00.000Z",
  updated_at: "2026-08-14T09:00:00.000Z",
};

const second: Notebook = {
  ...first,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Retrieval notes",
  updated_at: "2026-08-14T10:00:00.000Z",
};

const example: Notebook = {
  ...first,
  id: "00000000-0000-4000-8000-000000000003",
  owner_id: null,
  is_example: true,
  title: "Building Trustworthy AI",
  updated_at: "2026-08-13T10:00:00.000Z",
};

const exampleSource: ReadableSource = {
  id: "00000000-0000-4000-8000-000000000031",
  notebook_id: example.id,
  title: "Artificial Intelligence Risk Management Framework (AI RMF 1.0)",
  kind: "pdf",
  original_url: "https://doi.org/10.6028/NIST.AI.100-1",
  attribution: "Elham Tabassi (2023), NIST AI 100-1.",
  license_name: "NIST Technical Series reuse terms",
  license_url: "https://www.nist.gov/open/copyright",
  content: "Readable source content",
  storage_path: null,
  processing_stage: "ready",
  embedding_provider: "cloudflare-workers-ai",
  embedding_model: "@cf/baai/bge-small-en-v1.5",
  embedding_dimensions: 384,
  embedding_pooling: "cls",
  character_count: "Readable source content".length,
  failure_category: null,
  retry_stage: null,
  attempt_count: 0,
  correlation_id: null,
  created_at: "2026-08-13T10:00:00.000Z",
  updated_at: "2026-08-13T10:00:00.000Z",
  passages: [
    {
      id: "00000000-0000-4000-8100-000000000001",
      source_id: "00000000-0000-4000-8000-000000000031",
      ordinal: 0,
      content: "Trustworthy AI balances multiple characteristics in context.",
      page_number: 12,
      paragraph_start: null,
      paragraph_end: null,
      created_at: "2026-08-13T10:00:00.000Z",
    },
  ],
};

const privateSource: ReadableSource = {
  ...exampleSource,
  id: "10000000-0000-4000-8000-000000000031",
  notebook_id: first.id,
  title: "Private interview notes",
  kind: "pasted_text",
  original_url: null,
  attribution: "Added by this Guest",
  license_name: "Private Source",
  license_url: "",
  storage_path: null,
  passages: exampleSource.passages.map((passage) => ({
    ...passage,
    id: "10000000-0000-4000-8100-000000000001",
    source_id: "10000000-0000-4000-8000-000000000031",
    page_number: null,
    paragraph_start: 1,
    paragraph_end: 1,
  })),
};

const groundedMessages: ConversationMessage[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    conversation_id: "30000000-0000-4000-8000-000000000000",
    reply_to_message_id: null,
    ordinal: 1,
    role: "question",
    content: "What makes AI trustworthy?",
    status: "completed",
    answer_kind: null,
    evidence_passage_ids: [exampleSource.passages[0]!.id],
    correlation_id: "30000000-0000-4000-8000-000000000009",
    model_provider: null,
    model_name: null,
    created_at: "2026-08-14T10:00:00.000Z",
    completed_at: "2026-08-14T10:00:00.000Z",
    citations: [],
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    conversation_id: "30000000-0000-4000-8000-000000000000",
    reply_to_message_id: "30000000-0000-4000-8000-000000000001",
    ordinal: 2,
    role: "answer",
    content: "Trustworthy AI balances multiple characteristics in context.",
    status: "completed",
    answer_kind: "grounded",
    evidence_passage_ids: [],
    correlation_id: "30000000-0000-4000-8000-000000000009",
    model_provider: "cloudflare-workers-ai",
    model_name: "@cf/meta/llama-3.1-8b-instruct-fast",
    created_at: "2026-08-14T10:00:01.000Z",
    completed_at: "2026-08-14T10:00:02.000Z",
    citations: [
      {
        id: "30000000-0000-4000-8000-000000000003",
        answer_message_id: "30000000-0000-4000-8000-000000000002",
        passage_id: exampleSource.passages[0]!.id,
        display_order: 1,
        source_title: exampleSource.title,
        passage_content: exampleSource.passages[0]!.content,
        page_number: 12,
        paragraph_start: null,
        paragraph_end: null,
        created_at: "2026-08-14T10:00:02.000Z",
      },
    ],
  },
];

const savedNote = {
  id: "50000000-0000-4000-8000-000000000001",
  notebook_id: example.id,
  owner_id: first.owner_id!,
  origin_answer_id: groundedMessages[1]!.id,
  origin_question: groundedMessages[0]!.content,
  content: groundedMessages[1]!.content,
  created_at: "2026-08-14T11:00:00.000Z",
  updated_at: "2026-08-14T11:00:00.000Z",
};

describe("Notebook workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sourceList.mockResolvedValue([]);
    mocks.sourceCreate.mockResolvedValue(undefined);
    mocks.sourceAdvance.mockResolvedValue(undefined);
    mocks.sourceRemove.mockResolvedValue("removed");
    mocks.conversationList.mockResolvedValue([]);
    mocks.askQuestion.mockResolvedValue(undefined);
    mocks.noteList.mockResolvedValue([]);
  });

  it("lists persisted Notebooks, opens one, and renders the Sources empty state", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first, second]}
      />,
    );

    expect(await screen.findByText("No Sources yet")).toBeInTheDocument();
    openNotebookMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Trustworthy AI/ }));

    expect(mocks.replace).toHaveBeenCalledWith(
      `/?notebook=${first.id}`,
      expect.objectContaining({ scroll: false }),
    );
    expect(screen.getAllByText("Trustworthy AI").length).toBeGreaterThan(0);
    expect(
      screen.getByPlaceholderText(
        "Add a ready Source before asking a Question",
      ),
    ).toBeDisabled();
  });

  it("opens the Example Notebook first and previews ordered Source content", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first, example]}
      />,
    );

    expect(
      await screen.findByText("Ask, then inspect the evidence."),
    ).toBeInTheDocument();
    const sourceButton = await screen.findByRole("button", {
      name: `Preview ${exampleSource.title}`,
    });
    fireEvent.click(sourceButton);

    expect(screen.getByLabelText("Source preview")).toHaveTextContent(
      "Trustworthy AI balances multiple characteristics in context.",
    );
    expect(screen.getByText("PDF page 12")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /NIST Technical Series reuse terms/ }),
    ).toHaveAttribute("href", exampleSource.license_url);
  });

  it("makes Example Notebook actions visibly read-only", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    const addSourceButton = screen.getByRole("button", {
      name: "Add Source",
    });
    expect(addSourceButton).toBeDisabled();
    expect(addSourceButton).toHaveAccessibleDescription(
      "Sources in the Example Notebook are read-only.",
    );
    openNotebookMenu();
    expect(
      screen.queryByText("Rename active Notebook"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Delete active Notebook"),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      await screen.findByRole("button", {
        name: `Preview ${exampleSource.title}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: `Source actions for ${exampleSource.title}`,
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Preview ${exampleSource.title}`,
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Remove source" }),
    ).not.toBeInTheDocument();
  });

  it("removes a private Source from its card after an irreversible confirmation", async () => {
    let finishRemoval: (result: "removed") => void = () => undefined;
    mocks.sourceList.mockResolvedValueOnce([privateSource]);
    mocks.sourceRemove.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRemoval = resolve;
        }),
    );
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    await openSourceMenu(privateSource);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove source" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      `“${privateSource.title}”`,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Past Answers and Notes will remain",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

    expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep Source" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(
      document.querySelector(`[data-source-preview="${privateSource.id}"]`),
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    finishRemoval("removed");
    await waitFor(() =>
      expect(mocks.sourceRemove).toHaveBeenCalledWith(privateSource.id),
    );
    expect(await screen.findByText("No Sources yet")).toBeInTheDocument();
    expect(screen.getAllByText("Source removed").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Sources" })).toHaveFocus(),
    );
    expect(
      screen.getByPlaceholderText(
        "Add a ready Source before asking a Question",
      ),
    ).toBeDisabled();
  });

  it("offers Source removal from the readable preview", async () => {
    mocks.sourceList.mockResolvedValue([privateSource]);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: `Preview ${privateSource.title}`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(privateSource.title);
  });

  it("keeps an interrupted removal visible and lets the Guest retry", async () => {
    const deletingSource: ReadableSource = {
      ...privateSource,
      processing_stage: "deleting",
    };
    mocks.sourceList
      .mockResolvedValueOnce([privateSource])
      .mockResolvedValueOnce([deletingSource])
      .mockResolvedValueOnce([]);
    mocks.sourceRemove
      .mockRejectedValueOnce(
        new Error("Source removal did not finish. Try again."),
      )
      .mockResolvedValueOnce("removed");
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    await openSourceMenu(privateSource);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove source" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove source" }));

    expect(
      await screen.findByText("Source removal did not finish. Try again."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByText(/Removal incomplete/)).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Retry removal" }).at(-1)!,
    );

    expect(await screen.findByText("No Sources yet")).toBeInTheDocument();
    expect(mocks.sourceRemove).toHaveBeenCalledTimes(2);
  });

  it("automatically resumes a persisted deleting Source", async () => {
    mocks.sourceList
      .mockResolvedValueOnce([
        { ...privateSource, processing_stage: "deleting" },
      ])
      .mockResolvedValueOnce([]);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    await waitFor(() =>
      expect(mocks.sourceRemove).toHaveBeenCalledWith(privateSource.id),
    );
    expect(await screen.findByText("No Sources yet")).toBeInTheDocument();
  });

  it("adds validated pasted text to a private Notebook", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    expect(screen.getAllByText(/50,000 characters/)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Source title"), {
      target: { value: "Interview notes" },
    });
    fireEvent.change(screen.getByLabelText("Pasted text"), {
      target: { value: "First paragraph.\n\nSecond paragraph." },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Add Source" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mocks.sourceCreate).toHaveBeenCalledWith({
        notebookId: first.id,
        title: "Interview notes",
        kind: "pasted_text",
        content: "First paragraph.\n\nSecond paragraph.",
      }),
    );
  });

  it("switches to multi-PDF upload without changing a controlled input to uncontrolled", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    expect(screen.queryByLabelText("Source title")).not.toBeInTheDocument();
    expect(screen.getByLabelText("PDF files")).toHaveAttribute("multiple");
    expect(screen.queryByLabelText("Pasted text")).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "A component is changing a controlled input to be uncontrolled",
      ),
    );
    consoleError.mockRestore();
  });

  it("uploads multiple PDFs and generates a Source title for each filename", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    const governance = new File(["%PDF-1.7 governance"], "AI_Governance.pdf", {
      type: "application/pdf",
    });
    const riskRegister = new File(
      ["%PDF-1.7 risks"],
      "risk-register-2026.PDF",
      { type: "application/pdf" },
    );
    fireEvent.change(screen.getByLabelText("PDF files"), {
      target: { files: [governance, riskRegister] },
    });

    expect(screen.getByText("AI Governance")).toBeInTheDocument();
    expect(screen.getByText("risk register 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add 2 Sources" }));

    await waitFor(() => expect(mocks.sourceCreate).toHaveBeenCalledTimes(2));
    expect(mocks.sourceCreate).toHaveBeenNthCalledWith(1, {
      notebookId: first.id,
      title: "AI Governance",
      kind: "pdf",
      file: governance,
    });
    expect(mocks.sourceCreate).toHaveBeenNthCalledWith(2, {
      notebookId: first.id,
      title: "risk register 2026",
      kind: "pdf",
      file: riskRegister,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add PDF Sources" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("removes a selected PDF from its preview before upload", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    const firstPdf = new File(["%PDF-first"], "first-report.pdf", {
      type: "application/pdf",
    });
    const secondPdf = new File(["%PDF-second"], "second-report.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("PDF files"), {
      target: { files: [firstPdf, secondPdf] },
    });

    const dialog = screen.getByRole("dialog", { name: "Add PDF Sources" });
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Remove first-report.pdf",
      }),
    );

    expect(within(dialog).queryByText("first report")).not.toBeInTheDocument();
    expect(within(dialog).getByText("second report")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Source" }));

    await waitFor(() => expect(mocks.sourceCreate).toHaveBeenCalledTimes(1));
    expect(mocks.sourceCreate).toHaveBeenCalledWith({
      notebookId: first.id,
      title: "second report",
      kind: "pdf",
      file: secondPdf,
    });
  });

  it("accepts dropped PDFs and discards them when the dialog is canceled", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    const droppedPdf = new File(["%PDF-dropped"], "dropped-report.pdf", {
      type: "application/pdf",
    });
    const dialog = screen.getByRole("dialog", { name: "Add PDF Sources" });
    fireEvent.drop(
      within(dialog).getByRole("button", { name: /Drop PDFs here/ }),
      { dataTransfer: { files: [droppedPdf] } },
    );

    expect(within(dialog).getByText("dropped report")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Add PDF Sources" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    const reopenedDialog = screen.getByRole("dialog", {
      name: "Add PDF Sources",
    });
    expect(
      within(reopenedDialog).queryByText("dropped report"),
    ).not.toBeInTheDocument();
    expect(
      within(reopenedDialog).queryByRole("button", {
        name: "Remove dropped-report.pdf",
      }),
    ).not.toBeInTheDocument();
  });

  it("rejects non-PDF files dropped onto the upload area", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));

    const dialog = screen.getByRole("dialog", { name: "Add PDF Sources" });
    fireEvent.drop(
      within(dialog).getByRole("button", { name: /Drop PDFs here/ }),
      {
        dataTransfer: {
          files: [new File(["notes"], "notes.txt", { type: "text/plain" })],
        },
      },
    );

    expect(
      within(dialog).getByText("Only PDF files can be added."),
    ).toBeInTheDocument();
    expect(mocks.sourceCreate).not.toHaveBeenCalled();
  });

  it("checks a PDF batch against the remaining Source slots before upload", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
        limits={{
          ...DEFAULT_APPLICATION_LIMITS,
          sourcesPerNotebook: 1,
        }}
      />,
    );
    await screen.findByText("No Sources yet");
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload PDFs" }));
    fireEvent.change(screen.getByLabelText("PDF files"), {
      target: {
        files: [
          new File(["%PDF-one"], "one.pdf", { type: "application/pdf" }),
          new File(["%PDF-two"], "two.pdf", { type: "application/pdf" }),
        ],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add 2 Sources" }));

    expect(
      await screen.findByText("This Notebook has room for 1 more Source."),
    ).toBeInTheDocument();
    expect(mocks.sourceCreate).not.toHaveBeenCalled();
  });

  it("keeps Source rows visible while processing refreshes in the background", async () => {
    let finishRefresh: (sources: ReadableSource[]) => void = () => undefined;
    const processingSource: ReadableSource = {
      ...exampleSource,
      notebook_id: first.id,
      processing_stage: "uploaded",
      passages: [],
    };
    mocks.sourceList
      .mockResolvedValueOnce([processingSource])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRefresh = resolve;
          }),
      );

    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    const sourceButton = await screen.findByRole("button", {
      name: `Preview ${processingSource.title}`,
    });
    await waitFor(() => expect(mocks.sourceAdvance).toHaveBeenCalled());
    await waitFor(() => expect(mocks.sourceList).toHaveBeenCalledTimes(2));

    expect(sourceButton).toBeInTheDocument();
    expect(screen.queryByText("Loading Sources…")).not.toBeInTheDocument();

    finishRefresh([{ ...processingSource, processing_stage: "ready" }]);
  });

  it("restores a private grounded Answer and opens its exact Citation", async () => {
    const pastedSource: ReadableSource = {
      ...exampleSource,
      notebook_id: first.id,
      kind: "pasted_text",
      title: "Private interview notes",
      original_url: null,
      license_url: "",
      character_count: exampleSource.content.length,
      passages: [
        {
          ...exampleSource.passages[0]!,
          page_number: null,
          paragraph_start: 2,
          paragraph_end: 2,
        },
      ],
    };
    const pastedMessages = groundedMessages.map((message) => ({
      ...message,
      citations: message.citations.map((citation) => ({
        ...citation,
        source_title: pastedSource.title,
        page_number: null,
        paragraph_start: 2,
        paragraph_end: 2,
      })),
    }));
    mocks.sourceList.mockResolvedValue([pastedSource]);
    mocks.conversationList.mockResolvedValue(pastedMessages);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    expect(
      await screen.findByText(
        "Trustworthy AI balances multiple characteristics in context.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Citation 1" }));

    expect(screen.getByLabelText("Citation 1 inspector")).toHaveTextContent(
      pastedSource.title,
    );
    expect(screen.getByLabelText("Citation 1 inspector")).toHaveTextContent(
      "Paragraph 2",
    );
    expect(screen.getByLabelText("Citation 1 inspector")).toHaveTextContent(
      exampleSource.passages[0]!.content,
    );
  });

  it("submits an enabled Question when a ready Source is available", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    const input = await screen.findByPlaceholderText(
      "Ask only what your Sources can support",
    );
    fireEvent.change(input, {
      target: { value: "What are the four AI RMF functions?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Question" }));

    await waitFor(() =>
      expect(mocks.askQuestion).toHaveBeenCalledWith({
        notebookId: example.id,
        question: "What are the four AI RMF functions?",
      }),
    );
  });

  it("keeps and focuses a Question interrupted by Source removal", async () => {
    mocks.sourceList.mockResolvedValue([privateSource]);
    mocks.askQuestion.mockRejectedValue(
      new Error(
        "A Source was removed while this Answer was being prepared. Ask the Question again.",
      ),
    );
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    const input = await screen.findByPlaceholderText(
      "Ask only what your Sources can support",
    );
    fireEvent.change(input, {
      target: { value: "What evidence was removed?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit Question" }));

    expect(
      await screen.findByText(
        "A Source was removed while this Answer was being prepared. Ask the Question again.",
      ),
    ).toHaveAttribute("role", "alert");
    expect(input).toHaveValue("What evidence was removed?");
    expect(input).toHaveFocus();
  });

  it("saves a completed Answer as a linked Note and keeps Conversation state", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    mocks.conversationList.mockResolvedValue(groundedMessages);
    mocks.createNote.mockResolvedValue(savedNote);

    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Save Answer as Note" }),
    );

    await waitFor(() =>
      expect(mocks.createNote).toHaveBeenCalledWith({
        notebookId: example.id,
        answerId: groundedMessages[1]!.id,
        content: groundedMessages[1]!.content,
      }),
    );
    expect(screen.getByLabelText("Selected Note")).toHaveTextContent(
      groundedMessages[0]!.content,
    );
    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));
    expect(
      screen.getAllByText(groundedMessages[1]!.content).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Answer saved as Note" }),
    ).toBeDisabled();
  });

  it("shows a failed Note save in context and lets the Guest retry it", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    mocks.conversationList.mockResolvedValue(groundedMessages);
    mocks.createNote
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(savedNote);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Save Answer as Note" }),
    );
    expect(
      await screen.findByText("That Note didn’t save. Please try again."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));

    expect(
      await screen.findByRole("button", {
        name: new RegExp(savedNote.origin_question),
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Note saved").length).toBeGreaterThan(0);
  });

  it("restores, edits, and deletes a persisted private Note", async () => {
    mocks.noteList.mockResolvedValue([savedNote]);
    mocks.updateNote.mockResolvedValue({
      ...savedNote,
      content: "Edited evidence",
    });
    mocks.removeNote.mockResolvedValue(undefined);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: new RegExp(savedNote.origin_question),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Note content"), {
      target: { value: "Edited evidence" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocks.updateNote).toHaveBeenCalledWith(
        savedNote.id,
        "Edited evidence",
      ),
    );
    expect(screen.getByText("Edited evidence")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mocks.removeNote).toHaveBeenCalledWith(savedNote.id),
    );
    expect(screen.getByText("No Notes yet")).toBeInTheDocument();
  });

  it("opens keyboard-dismissible side drawers and returns focus to their trigger", async () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );
    const sourcesTrigger = screen.getByRole("button", { name: "Sources" });
    fireEvent.click(sourcesTrigger);
    expect(
      screen.getByRole("dialog", { name: "Sources drawer" }),
    ).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Sources drawer" }),
      ).not.toBeInTheDocument(),
    );
    expect(sourcesTrigger).toHaveFocus();
  });

  it("shows understandable Source loading and retry states", async () => {
    let rejectLoad: (reason?: unknown) => void = () => undefined;
    mocks.sourceList.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectLoad = reject;
        }),
    );
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    expect(screen.getByText("Loading Sources…")).toBeInTheDocument();
    await waitFor(() => expect(mocks.sourceList).toHaveBeenCalled());
    rejectLoad(new Error("offline"));
    expect(
      await screen.findByText("Sources couldn’t load"),
    ).toBeInTheDocument();

    mocks.sourceList.mockResolvedValueOnce([exampleSource]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", {
        name: `Preview ${exampleSource.title}`,
      }),
    ).toBeInTheDocument();
  });

  it("creates and opens a normalized Notebook", async () => {
    const created = { ...first, title: "New research" };
    mocks.create.mockResolvedValue(created);
    render(
      <NotebookWorkspace guestId={first.owner_id!} initialNotebooks={[]} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create your first Notebook" }),
    );
    fireEvent.change(screen.getByLabelText("Notebook title"), {
      target: { value: "  New   research  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Notebook" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        title: "New research",
      }),
    );
    expect(screen.getAllByText("New research").length).toBeGreaterThan(0);
    expect(mocks.replace).toHaveBeenCalledWith(
      `/?notebook=${created.id}`,
      expect.objectContaining({ scroll: false }),
    );
  });

  it("renames the active Notebook", async () => {
    const renamed = { ...first, title: "Evidence systems" };
    mocks.rename.mockResolvedValue(renamed);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    openNotebookMenu();
    fireEvent.click(screen.getByText("Rename active Notebook"));
    fireEvent.change(screen.getByLabelText("Notebook title"), {
      target: { value: "Evidence systems" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save title" }));

    await waitFor(() =>
      expect(mocks.rename).toHaveBeenCalledWith({
        id: first.id,
        title: "Evidence systems",
      }),
    );
    expect(screen.getAllByText("Evidence systems").length).toBeGreaterThan(0);
  });

  it("deletes the active Notebook and returns to the first-Notebook state", async () => {
    mocks.remove.mockResolvedValue(undefined);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[first]}
      />,
    );

    openNotebookMenu();
    fireEvent.click(screen.getByText("Delete active Notebook"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(first.id));
    expect(screen.getByText("A clear place to think.")).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith(
      "/",
      expect.objectContaining({ scroll: false }),
    );
  });

  it("keeps the create dialog open when persistence fails", async () => {
    mocks.create.mockRejectedValue(new Error("network unavailable"));
    render(
      <NotebookWorkspace guestId={first.owner_id!} initialNotebooks={[]} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Create your first Notebook" }),
    );
    fireEvent.change(screen.getByLabelText("Notebook title"), {
      target: { value: "Research" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Notebook" }));

    expect(
      await screen.findByText("That change didn't save. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

function openNotebookMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Choose a Notebook" }),
    {
      button: 0,
      ctrlKey: false,
    },
  );
}

async function openSourceMenu(source: ReadableSource) {
  fireEvent.pointerDown(
    await screen.findByRole("button", {
      name: `Source actions for ${source.title}`,
    }),
    {
      button: 0,
      ctrlKey: false,
    },
  );
}
