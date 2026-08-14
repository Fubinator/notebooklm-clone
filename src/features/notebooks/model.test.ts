import { describe, expect, it } from "vitest";

import {
  canCreateNotebook,
  NOTEBOOK_LIMIT,
  NOTEBOOK_TITLE_LIMIT,
  sortNotebooks,
  validateNotebookTitle,
  type Notebook,
} from "./model";

function notebook(id: string, updatedAt: string): Notebook {
  return {
    id,
    owner_id: "guest-a",
    is_example: false,
    title: `Notebook ${id}`,
    created_at: updatedAt,
    updated_at: updatedAt,
  };
}

describe("Notebook titles", () => {
  it("normalizes the title a Guest enters", () => {
    expect(validateNotebookTitle("  Trustworthy   AI \n systems  ")).toEqual({
      ok: true,
      title: "Trustworthy AI systems",
    });
  });

  it("requires a title", () => {
    expect(validateNotebookTitle("   ")).toEqual({
      ok: false,
      message: "Give your Notebook a title.",
    });
  });

  it("rejects titles over the persisted limit", () => {
    expect(validateNotebookTitle("x".repeat(NOTEBOOK_TITLE_LIMIT + 1))).toEqual(
      {
        ok: false,
        message: `Keep the title to ${NOTEBOOK_TITLE_LIMIT} characters or fewer.`,
      },
    );
  });
});

describe("Notebook collection", () => {
  it("stops creation at the visible Guest limit", () => {
    expect(canCreateNotebook(NOTEBOOK_LIMIT - 1)).toBe(true);
    expect(canCreateNotebook(NOTEBOOK_LIMIT)).toBe(false);
  });

  it("lists the most recently changed Notebook first without mutating input", () => {
    const older = notebook("older", "2026-08-13T10:00:00.000Z");
    const newer = notebook("newer", "2026-08-14T10:00:00.000Z");
    const input = [older, newer];

    expect(sortNotebooks(input)).toEqual([newer, older]);
    expect(input).toEqual([older, newer]);
  });

  it("keeps the shared Example Notebook ahead of private Notebooks", () => {
    const privateNotebook = notebook("private", "2026-08-14T10:00:00.000Z");
    const example = {
      ...notebook("example", "2026-08-13T10:00:00.000Z"),
      owner_id: null,
      is_example: true,
    };

    expect(sortNotebooks([privateNotebook, example])).toEqual([
      example,
      privateNotebook,
    ]);
  });
});
