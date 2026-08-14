"use client";

import { ArrowLeft, ExternalLink, FileText, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatPassageLocation,
  type ReadableSource,
} from "@/features/sources/model";

export function SourcePreview({
  source,
  onClose,
}: {
  source: ReadableSource;
  onClose: () => void;
}) {
  return (
    <article
      className="min-h-0 flex-1 overflow-y-auto"
      aria-label="Source preview"
    >
      <div className="mx-auto max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-3.5" /> Back to Conversation
        </Button>
        <div className="mt-5 flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--sage)]">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">
              {source.processing_stage === "ready" ? "Ready" : "Processing"} ·{" "}
              {source.passages.length} Passages
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-[-0.03em]">
              {source.title}
            </h1>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              {source.attribution}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
              {source.license_url ? (
                <a
                  className="inline-flex items-center gap-1 text-[var(--accent-strong)] hover:underline"
                  href={source.license_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.license_name} <ExternalLink className="size-3" />
                </a>
              ) : null}
              {source.original_url ? (
                <a
                  className="inline-flex items-center gap-1 text-[var(--accent-strong)] hover:underline"
                  href={source.original_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Original publication <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {!source.passages.length ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">
              <LoaderCircle className="mx-auto mb-3 size-5 animate-spin" />
              The extracted text preview will appear after Passages are built.
            </div>
          ) : null}
          {source.passages.map((passage) => (
            <section
              key={passage.id}
              className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_1px_2px_rgba(24,38,31,.03)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="eyebrow">Passage {passage.ordinal + 1}</p>
                <span className="rounded-full bg-[var(--paper-deep)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)]">
                  {formatPassageLocation(passage)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {passage.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
