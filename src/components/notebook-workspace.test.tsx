import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Notebook } from "@/features/notebooks/model";

import { NotebookWorkspace } from "./notebook-workspace";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
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

const first: Notebook = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

describe("Notebook workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists persisted Notebooks, opens one, and renders the Sources empty state", () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id}
        initialNotebooks={[first, second]}
      />,
    );

    expect(screen.getByLabelText("Sources")).toHaveTextContent(
      "No Sources yet",
    );
    openNotebookMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /Trustworthy AI/ }));

    expect(mocks.replace).toHaveBeenCalledWith(
      `/?notebook=${first.id}`,
      expect.objectContaining({ scroll: false }),
    );
    expect(screen.getAllByText("Trustworthy AI").length).toBeGreaterThan(0);
    expect(
      screen.getByPlaceholderText("Add a Source before asking a Question"),
    ).toBeDisabled();
  });

  it("creates and opens a normalized Notebook", async () => {
    const created = { ...first, title: "New research" };
    mocks.create.mockResolvedValue(created);
    render(
      <NotebookWorkspace guestId={first.owner_id} initialNotebooks={[]} />,
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
      <NotebookWorkspace guestId={first.owner_id} initialNotebooks={[first]} />,
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
      <NotebookWorkspace guestId={first.owner_id} initialNotebooks={[first]} />,
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
      <NotebookWorkspace guestId={first.owner_id} initialNotebooks={[]} />,
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
