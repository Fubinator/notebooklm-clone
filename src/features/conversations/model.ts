import type { Database } from "@/lib/database.types";

export type Citation = Database["public"]["Tables"]["citations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];

export type ConversationMessage = Message & { citations: Citation[] };

export const QUESTION_LIMIT = 1000;

export type QuestionValidation =
  { ok: true; question: string } | { ok: false; message: string };

export function validateQuestion(value: string): QuestionValidation {
  const question = value.trim().replace(/\s+/g, " ");

  if (!question) {
    return { ok: false, message: "Ask a Question about these Sources." };
  }

  if (question.length > QUESTION_LIMIT) {
    return {
      ok: false,
      message: `Keep the Question to ${QUESTION_LIMIT} characters or fewer.`,
    };
  }

  return { ok: true, question };
}

export function normalizeMessages(messages: ConversationMessage[]) {
  return [...messages]
    .map((message) => ({
      ...message,
      citations: [...message.citations].sort(
        (left, right) => left.display_order - right.display_order,
      ),
    }))
    .sort((left, right) => left.ordinal - right.ordinal);
}

export function formatCitationLocation(citation: Citation) {
  if (citation.page_number !== null) {
    return `PDF page ${citation.page_number}`;
  }

  if (citation.paragraph_start === citation.paragraph_end) {
    return `Paragraph ${citation.paragraph_start}`;
  }

  return `Paragraphs ${citation.paragraph_start}–${citation.paragraph_end}`;
}
