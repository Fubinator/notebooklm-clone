import { createClient } from "@/lib/supabase/client";

import { sortSources, type ReadableSource } from "./model";

export type SourceRepository = {
  list(notebookId: string): Promise<ReadableSource[]>;
};

export function createSourceRepository(): SourceRepository {
  const supabase = createClient();

  return {
    async list(notebookId) {
      const { data, error } = await supabase
        .from("sources")
        .select(
          "id, notebook_id, title, kind, original_url, attribution, license_name, license_url, content, processing_stage, embedding_model, embedding_dimensions, created_at, passages(id, source_id, ordinal, content, page_number, paragraph_start, paragraph_end, created_at)",
        )
        .eq("notebook_id", notebookId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return sortSources(data ?? []);
    },
  };
}
