import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationMessage } from "@/features/conversations/model";
import type { Notebook } from "@/features/notebooks/model";
import type { ReadableSource } from "@/features/sources/model";

import { NotebookWorkspace } from "./notebook-workspace";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  sourceList: vi.fn(),
  conversationList: vi.fn(),
  askQuestion: vi.fn(),
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
  createSourceRepository: () => ({ list: mocks.sourceList }),
}));

vi.mock("@/features/conversations/repository", () => ({
  createConversationRepository: () => ({
    list: mocks.conversationList,
    ask: mocks.askQuestion,
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
  processing_stage: "ready",
  embedding_provider: "cloudflare-workers-ai",
  embedding_model: "@cf/baai/bge-small-en-v1.5",
  embedding_dimensions: 384,
  embedding_pooling: "cls",
  created_at: "2026-08-13T10:00:00.000Z",
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

describe("Notebook workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sourceList.mockResolvedValue([]);
    mocks.conversationList.mockResolvedValue([]);
    mocks.askQuestion.mockResolvedValue(undefined);
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
    await screen.findByText("No Sources yet");
  });

  it("restores a private grounded Answer and opens its exact Citation", async () => {
    mocks.sourceList.mockResolvedValue([exampleSource]);
    mocks.conversationList.mockResolvedValue(groundedMessages);
    render(
      <NotebookWorkspace
        guestId={first.owner_id!}
        initialNotebooks={[example]}
      />,
    );

    expect(
      await screen.findByText(
        "Trustworthy AI balances multiple characteristics in context.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Citation 1" }));

    expect(screen.getByLabelText("Citation 1 inspector")).toHaveTextContent(
      exampleSource.title,
    );
    expect(screen.getByLabelText("Citation 1 inspector")).toHaveTextContent(
      "PDF page 12",
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
        ownerId: first.owner_id,
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
