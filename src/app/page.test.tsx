import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  hasSupabaseEnvironment: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ order: mocks.order }),
    }),
  }),
}));

vi.mock("@/components/notebook-workspace", () => ({
  NotebookWorkspace: ({
    guestId,
    initialNotebooks,
    initialActiveId,
  }: {
    guestId: string;
    initialNotebooks: Array<{ title: string }>;
    initialActiveId?: string;
  }) => (
    <div>
      Restored {guestId}:{" "}
      {initialNotebooks.map(({ title }) => title).join(", ")}
      <span>Active {initialActiveId}</span>
    </div>
  ),
}));

vi.mock("@/components/guest-gate", () => ({
  GuestGate: () => <div>Guest entry required</div>,
}));

const persistedNotebook = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  is_example: false,
  title: "Persisted research",
  created_at: "2026-08-14T09:00:00.000Z",
  updated_at: "2026-08-14T09:00:00.000Z",
};

describe("Guest session restoration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores the authenticated Guest and their persisted Notebooks", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: persistedNotebook.owner_id } },
    });
    mocks.order.mockResolvedValue({ data: [persistedNotebook], error: null });

    render(
      await Home({
        searchParams: Promise.resolve({ notebook: persistedNotebook.id }),
      }),
    );

    expect(
      screen.getByText(
        `Restored ${persistedNotebook.owner_id}: ${persistedNotebook.title}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Active ${persistedNotebook.id}`),
    ).toBeInTheDocument();
  });

  it("requests Guest entry only when no session can be restored", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Guest entry required")).toBeInTheDocument();
    expect(mocks.order).not.toHaveBeenCalled();
  });
});
