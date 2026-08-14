import type { Database } from "@/lib/database.types";

export type Notebook = Database["public"]["Tables"]["notebooks"]["Row"];

export const NOTEBOOK_LIMIT = 5;
export const NOTEBOOK_TITLE_LIMIT = 80;

export type TitleValidation =
  { ok: true; title: string } | { ok: false; message: string };

export function validateNotebookTitle(value: string): TitleValidation {
  const title = value.trim().replace(/\s+/g, " ");

  if (!title) {
    return { ok: false, message: "Give your Notebook a title." };
  }

  if (title.length > NOTEBOOK_TITLE_LIMIT) {
    return {
      ok: false,
      message: `Keep the title to ${NOTEBOOK_TITLE_LIMIT} characters or fewer.`,
    };
  }

  return { ok: true, title };
}

export function canCreateNotebook(count: number) {
  return count < NOTEBOOK_LIMIT;
}

export function sortNotebooks(notebooks: Notebook[]) {
  return [...notebooks].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() -
      new Date(left.updated_at).getTime(),
  );
}

export function displayGuestId(id: string) {
  return id.slice(0, 6).toUpperCase();
}
