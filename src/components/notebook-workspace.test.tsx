import { fireEvent, render, screen } from "@testing-library/react";
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

  it("lists persisted Notebooks and opens a selected Notebook", () => {
    render(
      <NotebookWorkspace
        guestId={first.owner_id}
        initialNotebooks={[first, second]}
      />,
    );

    expect(screen.getAllByText("Retrieval notes").length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: /Trustworthy AI Today/i }),
    );

    expect(mocks.replace).toHaveBeenCalledWith(
      `/?notebook=${first.id}`,
      expect.objectContaining({ scroll: false }),
    );
    expect(screen.getAllByText("Trustworthy AI").length).toBeGreaterThan(1);
    expect(
      screen.getByPlaceholderText("Add a Source before asking a Question"),
    ).toBeDisabled();
  });

  it("shows an intentional first-Notebook empty state", () => {
    render(
      <NotebookWorkspace guestId={first.owner_id} initialNotebooks={[]} />,
    );

    expect(screen.getByText("A clear place to think.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create your first Notebook" }),
    ).toBeEnabled();
  });
});
