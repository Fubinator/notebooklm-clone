import { createClient } from "@/lib/supabase/client";

import type { Notebook } from "./model";

export type NotebookRepository = {
  create(input: { ownerId: string; title: string }): Promise<Notebook>;
  rename(input: { id: string; title: string }): Promise<Notebook>;
  remove(id: string): Promise<void>;
};

export function createNotebookRepository(): NotebookRepository {
  const supabase = createClient();

  return {
    async create({ ownerId, title }) {
      const { data, error } = await supabase
        .from("notebooks")
        .insert({ owner_id: ownerId, title })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async rename({ id, title }) {
      const { data, error } = await supabase
        .from("notebooks")
        .update({ title })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    async remove(id) {
      const { error } = await supabase.from("notebooks").delete().eq("id", id);
      if (error) throw error;
    },
  };
}
