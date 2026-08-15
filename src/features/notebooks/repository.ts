import type { Notebook } from "./model";

export type NotebookRepository = {
  create(input: { ownerId: string; title: string }): Promise<Notebook>;
  rename(input: { id: string; title: string }): Promise<Notebook>;
  remove(id: string): Promise<void>;
};

export function createNotebookRepository(): NotebookRepository {
  return {
    async create({ title }) {
      return notebookRequest("POST", { title });
    },

    async rename({ id, title }) {
      return notebookRequest("PATCH", { id, title });
    },

    async remove(id) {
      await notebookRequest("DELETE", { id }, false);
    },
  };
}

async function notebookRequest(
  method: "POST" | "PATCH" | "DELETE",
  body: { id?: string; title?: string },
  expectsNotebook = true,
) {
  const response = await fetch("/api/notebooks", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    notebook?: Notebook;
    error?: string;
  } | null;
  if (!response.ok)
    throw new Error(payload?.error ?? "Notebook request failed.");
  if (!expectsNotebook) return undefined as never;
  if (!payload?.notebook) throw new Error("Notebook response was invalid.");
  return payload.notebook;
}
