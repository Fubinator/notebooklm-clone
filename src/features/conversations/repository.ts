import { createClient } from "@/lib/supabase/client";

import { normalizeMessages, type ConversationMessage } from "./model";

type ConversationRecord = {
  messages: ConversationMessage[];
};

export type ConversationRepository = {
  list(notebookId: string): Promise<ConversationMessage[]>;
  ask(input: { notebookId: string; question: string }): Promise<void>;
};

export function createConversationRepository(): ConversationRepository {
  const supabase = createClient();

  return {
    async list(notebookId) {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "messages(id, conversation_id, reply_to_message_id, ordinal, role, content, status, answer_kind, evidence_passage_ids, correlation_id, model_provider, model_name, created_at, completed_at, citations(id, answer_message_id, passage_id, display_order, source_title, passage_content, page_number, paragraph_start, paragraph_end, created_at))",
        )
        .eq("notebook_id", notebookId)
        .maybeSingle();

      if (error) throw error;
      const conversation = data as ConversationRecord | null;
      return normalizeMessages(conversation?.messages ?? []);
    },

    async ask({ notebookId, question }) {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, question }),
      });

      if (response.ok) return;

      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
      } | null;
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "The Question could not be answered.",
      );
    },
  };
}
