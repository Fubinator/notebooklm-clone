"use client";

import { BookOpen, Sparkles, StickyNote } from "lucide-react";
import { CitationInspector } from "@/components/citation-inspector";
import type { Citation } from "@/features/conversations/model";
import { cn } from "@/lib/utils";

export function StudioPane({
  visible,
  citation,
  onCloseCitation,
}: {
  visible: boolean;
  citation?: Citation;
  onCloseCitation: () => void;
}) {
  return (
    <aside
      className={cn(
        "min-h-0 flex-col border-l border-[var(--line)] bg-[#f7f3e9] lg:flex",
        visible ? "flex" : "hidden",
      )}
      aria-label="Studio"
    >
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[var(--accent-strong)]" />
          <h2 className="text-sm font-semibold">Studio</h2>
        </div>
        <span className="text-[11px] font-medium text-[var(--muted-light)]">
          Context
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {citation ? (
          <CitationInspector citation={citation} onClose={onCloseCitation} />
        ) : (
          <StudioEmpty />
        )}
      </div>
    </aside>
  );
}

function StudioEmpty() {
  return (
    <>
      <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_1px_rgba(24,38,31,.03)]">
        <div className="flex items-start justify-between">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--lavender)] text-[#5e5876]">
            <BookOpen className="size-4" />
          </span>
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[var(--muted-light)] uppercase">
            Soon
          </span>
        </div>
        <h3 className="mt-4 font-serif text-lg font-semibold">
          Notebook guide
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
          A concise overview will appear after your Sources are ready.
        </p>
        <div className="mt-4 space-y-2">
          <div className="h-2 w-full rounded-full bg-[var(--paper-deep)]" />
          <div className="h-2 w-4/5 rounded-full bg-[var(--paper-deep)]" />
          <div className="h-2 w-3/5 rounded-full bg-[var(--paper-deep)]" />
        </div>
      </section>
      <div className="my-5 flex items-center justify-between">
        <p className="eyebrow">Notes</p>
        <span className="text-[11px] font-semibold text-[var(--muted-light)]">
          0 saved
        </span>
      </div>
      <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-5 text-center">
        <StickyNote className="mx-auto size-5 text-[var(--muted-light)]" />
        <p className="mt-3 text-xs font-semibold">No Notes yet</p>
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
          Open a Citation to inspect its exact supporting Passage.
        </p>
      </div>
    </>
  );
}
