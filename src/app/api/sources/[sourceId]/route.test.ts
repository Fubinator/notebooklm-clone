import { beforeEach, describe, expect, it, vi } from "vitest";

const guestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sourceId = "11111111-1111-4111-8111-111111111111";
const notebookId = "22222222-2222-4222-8222-222222222222";
const storagePath = `${guestId}/${notebookId}/${sourceId}/original.pdf`;

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  storageRemove: vi.fn(),
  writeStructuredLog: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
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

describe("DELETE /api/sources/[sourceId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: guestId } } });
    mocks.storageFrom.mockReturnValue({ remove: mocks.storageRemove });
    mocks.storageRemove.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "begin_private_source_deletion"
        ? {
            data: [
              {
                source_id: sourceId,
                notebook_id: notebookId,
                storage_path: storagePath,
              },
            ],
            error: null,
          }
        : { data: true, error: null },
    );
  });

  it("marks intent, removes the private PDF, and only then deletes records", async () => {
    const response = await removeSource();

    expect(response.status).toBe(204);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      "begin_private_source_deletion",
      { target_guest_id: guestId, target_source_id: sourceId },
    );
    expect(mocks.storageFrom).toHaveBeenCalledWith("source-files");
    expect(mocks.storageRemove).toHaveBeenCalledWith([storagePath]);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "complete_private_source_deletion",
      { target_guest_id: guestId, target_source_id: sourceId },
    );
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.storageRemove.mock.invocationCallOrder[0]!,
    );
    expect(mocks.storageRemove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[1]!,
    );
  });

  it("deletes a pasted Source without calling Storage", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "begin_private_source_deletion"
        ? {
            data: [
              {
                source_id: sourceId,
                notebook_id: notebookId,
                storage_path: null,
              },
            ],
            error: null,
          }
        : { data: true, error: null },
    );

    expect((await removeSource()).status).toBe(204);
    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });

  it("returns the same not-found response for an unavailable or Example Source", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "source_not_authorized" },
    });

    const response = await removeSource();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "That Source is not available.",
    });
    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });

  it("keeps the deleting Source retryable when Storage cleanup fails", async () => {
    mocks.storageRemove.mockResolvedValue({
      data: null,
      error: { message: "storage unavailable" },
    });

    const response = await removeSource();

    expect(response.status).toBe(500);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      error: "Source removal did not finish. Try again.",
    });
  });

  it("reports incomplete cleanup when the final database step fails", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "begin_private_source_deletion"
        ? {
            data: [
              {
                source_id: sourceId,
                notebook_id: notebookId,
                storage_path: storagePath,
              },
            ],
            error: null,
          }
        : { data: null, error: { message: "database unavailable" } },
    );

    const response = await removeSource();

    expect(response.status).toBe(500);
    expect(mocks.storageRemove).toHaveBeenCalledOnce();
  });

  it("requires authentication and a valid Source identifier", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await removeSource()).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();

    const invalid = await DELETE(
      new Request("http://localhost/api/sources/x"),
      {
        params: Promise.resolve({ sourceId: "not-a-uuid" }),
      },
    );
    expect(invalid.status).toBe(400);
  });
});

function removeSource() {
  return DELETE(
    new Request(`http://localhost/api/sources/${sourceId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ sourceId }) },
  );
}
