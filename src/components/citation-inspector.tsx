"use client";

import { BookOpen, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatCitationLocation,
  type Citation,
} from "@/features/conversations/model";

export function CitationInspector({
  citation,
  onClose,
}: {
  citation: Citation;
  onClose: () => void;
}) {
  return (
    <article
      className="p-4"
      aria-label={`Citation ${citation.display_order} inspector`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--sage)]">
          <BookOpen className="size-4" />
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close Citation inspector"
        >
          <X className="size-4" />
        </Button>
      </div>
      <p className="eyebrow mt-5">
        Validated Citation {citation.display_order}
      </p>
      <h3 className="mt-2 font-serif text-xl leading-6 font-semibold">
        {citation.source_title}
      </h3>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--paper-deep)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
        <FileText className="size-3.5" />
        {formatCitationLocation(citation)}
      </div>
      <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
        {citation.passage_content}
      </p>
      <p className="mt-5 border-t border-[var(--line)] pt-4 text-[11px] leading-4 text-[var(--muted)]">
        {citation.passage_id
          ? "This is the exact stored Passage validated for the Answer."
          : "The original Passage is no longer available; this is its Citation snapshot."}
      </p>
    </article>
  );
}
