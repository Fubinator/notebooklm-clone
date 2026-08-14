"use client";

import {
  Check,
  ChevronDown,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayGuestId, type Notebook } from "@/features/notebooks/model";
import { cn } from "@/lib/utils";

export function NotebookHeader({
  guestId,
  notebooks,
  activeNotebook,
  atLimit,
  notebookLimit = 5,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  guestId: string;
  notebooks: Notebook[];
  activeNotebook?: Notebook;
  atLimit: boolean;
  notebookLimit?: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const exampleNotebook = notebooks.find(({ is_example }) => is_example);
  const privateNotebooks = notebooks.filter(({ is_example }) => !is_example);

  return (
    <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--line)] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <BrandMark compact />
        <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[var(--ink)] sm:min-w-52"
              aria-label="Choose a Notebook"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--accent)] text-[var(--ink)]">
                <NotebookPen className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {activeNotebook?.title ?? "Your Notebooks"}
                </span>
                <span className="hidden text-[11px] text-[var(--muted-light)] sm:block">
                  {activeNotebook?.is_example
                    ? "Example · read-only"
                    : `${privateNotebooks.length}/${notebookLimit} private`}
                </span>
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-[var(--muted)]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <div className="px-3 py-2">
              <p className="eyebrow">Notebooks</p>
            </div>
            {exampleNotebook ? (
              <>
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wide text-[var(--muted-light)] uppercase">
                  Shared example
                </p>
                <NotebookMenuItem
                  notebook={exampleNotebook}
                  active={activeNotebook?.id === exampleNotebook.id}
                  onSelect={onSelect}
                />
                <div className="my-1 h-px bg-[var(--line)]" />
              </>
            ) : null}
            <p className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-wide text-[var(--muted-light)] uppercase">
              Your Notebooks
            </p>
            {privateNotebooks.length ? (
              privateNotebooks.map((notebook) => (
                <NotebookMenuItem
                  key={notebook.id}
                  notebook={notebook}
                  active={activeNotebook?.id === notebook.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <p className="px-3 py-3 text-xs leading-5 text-[var(--muted)]">
                Create a private Notebook to begin.
              </p>
            )}
            <div className="my-1 h-px bg-[var(--line)]" />
            <DropdownMenuItem disabled={atLimit} onSelect={onCreate}>
              <Plus className="size-3.5" />
              New Notebook
              {atLimit ? (
                <span className="ml-auto text-[10px] text-[var(--muted-light)]">
                  Limit reached
                </span>
              ) : null}
            </DropdownMenuItem>
            {activeNotebook && !activeNotebook.is_example ? (
              <>
                <DropdownMenuItem onSelect={onRename}>
                  <Pencil className="size-3.5" /> Rename active Notebook
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[var(--danger)] data-[highlighted]:bg-[#f9ece8]"
                  onSelect={onDelete}
                >
                  <Trash2 className="size-3.5" /> Delete active Notebook
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          className="hidden sm:inline-flex"
          size="sm"
          onClick={onCreate}
          disabled={atLimit}
        >
          <Plus className="size-3.5" /> New Notebook
        </Button>
        <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] md:flex">
          <span className="size-1.5 rounded-full bg-[#5f8f6a]" />
          Saved
        </div>
        <div
          className="grid size-9 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--ink)]"
          title={`Private Guest ${displayGuestId(guestId)}`}
        >
          G{displayGuestId(guestId).slice(0, 1)}
        </div>
      </div>
    </header>
  );
}

function NotebookMenuItem({
  notebook,
  active,
  onSelect,
}: {
  notebook: Notebook;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <DropdownMenuItem
      className="justify-between"
      onSelect={() => onSelect(notebook.id)}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{notebook.title}</span>
        <span className="block text-[10px] text-[var(--muted-light)]">
          {notebook.is_example
            ? "Ready Sources for every Guest"
            : formatUpdatedAt(notebook.updated_at)}
        </span>
      </span>
      <Check
        className={cn(
          "size-4 shrink-0 text-[var(--accent-strong)]",
          !active && "invisible",
        )}
      />
    </DropdownMenuItem>
  );
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? `Today · ${new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)}`
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        date,
      );
}
