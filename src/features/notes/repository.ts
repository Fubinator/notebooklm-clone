import { createClient } from "@/lib/supabase/client";

import type { Note } from "./model";

export type NoteRepository = {
  list(notebookId: string): Promise<Note[]>;
  create(input: {
    notebookId: string;
    ownerId: string;
    answerId: string;
    question: string;
    content: string;
  }): Promise<Note>;
  update(id: string, content: string): Promise<Note>;
  remove(id: string): Promise<void>;
};

export function createNoteRepository(): NoteRepository {
  const supabase = createClient();
  return {
    async list(notebookId) {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("notebook_id", notebookId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async create({ notebookId, ownerId, answerId, question, content }) {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          notebook_id: notebookId,
          owner_id: ownerId,
          origin_answer_id: answerId,
          origin_question: question,
          content,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async update(id, content) {
      const { data, error } = await supabase
        .from("notes")
        .update({ content })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
