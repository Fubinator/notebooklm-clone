import type { Database } from "@/lib/database.types";

export type Note = Database["public"]["Tables"]["notes"]["Row"];

export function validateNoteContent(value: string) {
  const content = value.trim();
  if (!content)
    return { ok: false as const, message: "A Note cannot be empty." };
  if (content.length > 12_000) {
    return {
      ok: false as const,
      message: "Keep Notes under 12,000 characters.",
    };
  }
  return { ok: true as const, content };
}
