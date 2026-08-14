import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

export type PendingAnswer = {
  conversationId: string;
  questionId: string;
  answerId: string;
};

export type AnsweringPersistence = {
  begin(input: {
    notebookId: string;
    question: string;
    correlationId: string;
  }): Promise<PendingAnswer>;
  recordEvidence(questionId: string, passageIds: string[]): Promise<void>;
  complete(input: {
    answerId: string;
    content: string;
    kind: "grounded" | "insufficient_evidence";
    provider: string | null;
    model: string | null;
    citationIds: string[];
  }): Promise<void>;
  fail(answerId: string): Promise<void>;
};

export function createAnsweringPersistence(
  supabase: SupabaseClient<Database>,
  guestId: string,
): AnsweringPersistence {
  return {
    async begin({ notebookId, question, correlationId }) {
      const { data, error } = await supabase.rpc("begin_grounded_question", {
        target_guest_id: guestId,
        target_notebook_id: notebookId,
        question_content: question,
        request_correlation_id: correlationId,
      });
      if (error) throw error;

      const pending = data[0];
      if (!pending) throw new Error("question_persistence_failed");
      return {
        conversationId: pending.conversation_id,
        questionId: pending.question_id,
        answerId: pending.answer_id,
      };
    },

    async recordEvidence(questionId, passageIds) {
      const { error } = await supabase.rpc("record_grounded_evidence", {
        target_guest_id: guestId,
        target_question_id: questionId,
        evidence_ids: passageIds,
      });
      if (error) throw error;
    },

    async complete({ answerId, content, kind, provider, model, citationIds }) {
      const { error } = await supabase.rpc("complete_grounded_answer", {
        target_guest_id: guestId,
        target_answer_id: answerId,
        answer_content: content,
        completion_kind: kind,
        completion_provider: provider,
        completion_model: model,
        cited_passage_ids: citationIds,
      });
      if (error) throw error;
    },

    async fail(answerId) {
      const { error } = await supabase.rpc("fail_grounded_answer", {
        target_guest_id: guestId,
        target_answer_id: answerId,
      });
      if (error) throw error;
    },
  };
}
