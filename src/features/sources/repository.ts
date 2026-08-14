import { createClient } from "@/lib/supabase/client";

import { normalizeSourcePassages, type ReadableSource } from "./model";

export type SourceRepository = {
  list(notebookId: string): Promise<ReadableSource[]>;
  create(
    input:
      | {
          notebookId: string;
          title: string;
          kind: "pasted_text";
          content: string;
        }
      | { notebookId: string; title: string; kind: "pdf"; file: File },
  ): Promise<void>;
  advance(sourceId: string): Promise<void>;
};

export function createSourceRepository(): SourceRepository {
  const supabase = createClient();

  return {
    async list(notebookId) {
      const { data, error } = await supabase
        .from("sources")
        .select(
          "id, notebook_id, title, kind, original_url, attribution, license_name, license_url, content, storage_path, processing_stage, embedding_provider, embedding_model, embedding_dimensions, embedding_pooling, character_count, failure_category, retry_stage, attempt_count, correlation_id, created_at, updated_at, passages(id, source_id, ordinal, content, page_number, paragraph_start, paragraph_end, created_at)",
        )
        .eq("notebook_id", notebookId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return normalizeSourcePassages(data ?? []);
    },
    async create(input) {
      const pdf = input.kind === "pdf";
      let body: FormData | string;
      if (pdf) {
        const form = new FormData();
        form.append("notebookId", input.notebookId);
        form.append("title", input.title);
        form.append("file", input.file);
        body = form;
      } else {
        body = JSON.stringify(input);
      }
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: pdf ? undefined : { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "The Source could not be added.");
      }
    },
    async advance(sourceId) {
      const response = await fetch(`/api/sources/${sourceId}/advance`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "The Source could not be processed.");
      }
    },
  };
}
