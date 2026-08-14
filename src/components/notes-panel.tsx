"use client";

import {
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Note } from "@/features/notes/model";
import type { NotesLoadState } from "@/features/notes/use-notes";

export function NotesPanel({
  notes,
  status,
  selectedId,
  pending,
  error,
  onSelect,
  onUpdate,
  onDelete,
  onRetry,
}: {
  notes: Note[];
  status: NotesLoadState;
  selectedId?: string;
  pending: boolean;
  error?: string;
  onSelect: (id?: string) => void;
  onUpdate: (id: string, content: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRetry: () => void;
}) {
  const selected = notes.find((note) => note.id === selectedId);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => {
    // Reset the local draft when the user opens a different persisted Note.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContent(selected?.content ?? "");
    setEditing(false);
  }, [selected]);

  if (status === "loading")
    return (
      <PanelStatus
        icon={<LoaderCircle className="size-5 animate-spin" />}
        title="Loading Notes…"
      />
    );
  if (status === "error")
    return (
      <PanelStatus
        title="Notes couldn’t load"
        action={
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Try again
          </Button>
        }
      />
    );

  if (selected) {
    return (
      <article
        aria-label="Selected Note"
        className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Saved from Answer</p>
            <h3 className="mt-2 text-sm leading-5 font-semibold">
              {selected.origin_question}
            </h3>
          </div>
          <button
            aria-label="Close Note"
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none"
            onClick={() => onSelect(undefined)}
          >
            <X className="size-4" />
          </button>
        </div>
        {editing ? (
          <textarea
            aria-label="Note content"
            className="mt-4 min-h-56 w-full resize-y rounded-xl border border-[var(--line-strong)] p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        ) : (
          <p className="mt-4 text-sm leading-6 whitespace-pre-wrap text-[var(--ink-soft)]">
            {selected.content}
          </p>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          {editing ? (
            <Button
              size="sm"
              disabled={pending || !content.trim()}
              onClick={async () => {
                if (await onUpdate(selected.id, content)) setEditing(false);
              }}
            >
              <Save className="size-3.5" /> Save changes
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={async () => {
              if (await onDelete(selected.id)) onSelect(undefined);
            }}
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </article>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="eyebrow">Notes</p>
        <span className="text-[11px] font-semibold text-[var(--muted-light)]">
          {notes.length} saved
        </span>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
      {notes.length ? (
        <div className="space-y-2">
          {notes.map((note) => (
            <button
              key={note.id}
              className="w-full rounded-xl border border-[var(--line)] bg-white p-3 text-left transition-colors hover:border-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none"
              onClick={() => onSelect(note.id)}
            >
              <span className="block text-xs leading-5 font-semibold">
                {note.origin_question}
              </span>
              <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[var(--muted)]">
                {note.content}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-5 text-center">
          <StickyNote className="mx-auto size-5 text-[var(--muted-light)]" />
          <p className="mt-3 text-xs font-semibold">No Notes yet</p>
          <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
            Save a completed Answer to keep it with this Notebook.
          </p>
        </div>
      )}
    </div>
  );
}

function PanelStatus({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-48 place-items-center text-center" role="status">
      <div>
        {icon}
        <p className="mt-3 text-sm font-semibold">{title}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
