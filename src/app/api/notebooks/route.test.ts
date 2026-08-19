import { beforeEach, describe, expect, it, vi } from "vitest";

const guestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const notebookId = "22222222-2222-4222-8222-222222222222";
const firstSourceId = "11111111-1111-4111-8111-111111111111";
const secondSourceId = "33333333-3333-4333-8333-333333333333";
const storagePath = `${guestId}/${notebookId}/${firstSourceId}/original.pdf`;

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  notebookMaybeSingle: vi.fn(),
  sourceList: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
  writeStructuredLog: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  }),
}));

vi.mock("@/lib/structured-log", () => ({
  writeStructuredLog: mocks.writeStructuredLog,
}));

import { DELETE } from "./route";

describe("DELETE /api/notebooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: guestId } } });
    mocks.notebookMaybeSingle.mockResolvedValue({
      data: { id: notebookId },
      error: null,
    });
    mocks.sourceList.mockResolvedValue({
      data: [
        { id: firstSourceId, storage_path: storagePath },
        { id: secondSourceId, storage_path: null },
      ],
      error: null,
    });
    mocks.storageFrom.mockReturnValue({ remove: mocks.storageRemove });
    mocks.storageRemove.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    const notebookQuery = chain({
      maybeSingle: mocks.notebookMaybeSingle,
    });
    const sourceQuery = chain({ eq: mocks.sourceList });
    mocks.from.mockImplementation((table: string) =>
      table === "notebooks" ? notebookQuery : sourceQuery,
    );
  });

  it("removes every private PDF before deleting the exact Source set", async () => {
    const response = await removeNotebook();

    expect(response.status).toBe(204);
    expect(mocks.storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_private_notebook", {
      target_guest_id: guestId,
      target_notebook_id: notebookId,
      expected_source_ids: [firstSourceId, secondSourceId],
    });
    expect(mocks.storageRemove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[0]!,
    );
  });

  it("does not delete the Notebook when Storage cleanup fails", async () => {
    mocks.storageRemove.mockResolvedValue({
      data: null,
      error: { message: "storage unavailable" },
    });

    const response = await removeNotebook();

    expect(response.status).toBe(500);
    expect(mocks.rpc).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Notebook removal did not finish. Try again.",
    });
  });

  it("keeps the Notebook when its Source set changes during cleanup", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "notebook_sources_changed" },
    });

    const response = await removeNotebook();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "The Notebook changed while it was being removed. Try removal again.",
    });
  });

  it("returns not found without touching Storage for an unavailable Notebook", async () => {
    mocks.notebookMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await removeNotebook();

    expect(response.status).toBe(404);
    expect(mocks.sourceList).not.toHaveBeenCalled();
    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });
});

function removeNotebook() {
  return DELETE(
    new Request("http://localhost/api/notebooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notebookId }),
    }),
  );
}

function chain(overrides: Record<string, ReturnType<typeof vi.fn>>) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "delete"]) {
    query[method] = vi.fn(() => query);
  }
  Object.assign(query, overrides);
  return query;
}
