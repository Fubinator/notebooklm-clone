"use client";

import { BookOpen, Quote, Sparkles, StickyNote } from "lucide-react";
import { CitationInspector } from "@/components/citation-inspector";
import { NotesPanel } from "@/components/notes-panel";
import type { Citation } from "@/features/conversations/model";
import type { Note } from "@/features/notes/model";
import type { NotesLoadState } from "@/features/notes/use-notes";
import { cn } from "@/lib/utils";

export function StudioPane({
  visible,
  citation,
  onCloseCitation,
  view,
  onViewChange,
  notes,
  notesStatus,
  selectedNoteId,
  notesPending,
  notesError,
  onSelectNote,
  onUpdateNote,
  onDeleteNote,
  onRetryNotes,
}: {
  visible: boolean;
  citation?: Citation;
  onCloseCitation: () => void;
  view: "citation" | "notes";
  onViewChange: (view: "citation" | "notes") => void;
  notes: Note[];
  notesStatus: NotesLoadState;
  selectedNoteId?: string;
  notesPending: boolean;
  notesError?: string;
  onSelectNote: (id?: string) => void;
  onUpdateNote: (id: string, content: string) => Promise<boolean>;
  onDeleteNote: (id: string) => Promise<boolean>;
  onRetryNotes: () => void;
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
      <div
        className="flex border-b border-[var(--line)] p-2"
        role="tablist"
        aria-label="Context panel"
      >
        <ContextTab
          active={view === "citation"}
          onClick={() => onViewChange("citation")}
          icon={Quote}
        >
          Citation
        </ContextTab>
        <ContextTab
          active={view === "notes"}
          onClick={() => onViewChange("notes")}
          icon={StickyNote}
        >
          Notes ({notes.length})
        </ContextTab>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {view === "notes" ? (
          <NotesPanel
            notes={notes}
            status={notesStatus}
            selectedId={selectedNoteId}
            pending={notesPending}
            error={notesError}
            onSelect={onSelectNote}
            onUpdate={onUpdateNote}
            onDelete={onDeleteNote}
            onRetry={onRetryNotes}
          />
        ) : citation ? (
          <CitationInspector citation={citation} onClose={onCloseCitation} />
        ) : (
          <StudioEmpty />
        )}
      </div>
    </aside>
  );
}

function ContextTab({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Quote;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[var(--muted)] outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-[var(--ink)]",
        active && "bg-white text-[var(--ink)] shadow-sm",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
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
      <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
        Choose Notes above to review saved Answers without leaving the
        Conversation.
      </p>
    </>
  );
}
