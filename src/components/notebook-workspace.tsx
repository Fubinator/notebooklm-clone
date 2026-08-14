"use client";

import {
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  FolderPlus,
  Lightbulb,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  NotebookPen,
  PanelRight,
  Pencil,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  canCreateNotebook,
  displayGuestId,
  NOTEBOOK_LIMIT,
  type Notebook,
  sortNotebooks,
  validateNotebookTitle,
} from "@/features/notebooks/model";
import { createNotebookRepository } from "@/features/notebooks/repository";
import { cn } from "@/lib/utils";

type MobilePanel = "sources" | "conversation" | "studio";

type WorkspaceProps = {
  guestId: string;
  initialNotebooks: Notebook[];
  initialActiveId?: string;
  initialError?: string;
};

export function NotebookWorkspace({
  guestId,
  initialNotebooks,
  initialActiveId,
  initialError,
}: WorkspaceProps) {
  const router = useRouter();
  const repository = useMemo(() => createNotebookRepository(), []);
  const [notebooks, setNotebooks] = useState(() =>
    sortNotebooks(initialNotebooks),
  );
  const [activeId, setActiveId] = useState(
    initialActiveId && initialNotebooks.some(({ id }) => id === initialActiveId)
      ? initialActiveId
      : initialNotebooks[0]?.id,
  );
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("conversation");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Notebook>();
  const [deleteTarget, setDeleteTarget] = useState<Notebook>();
  const [title, setTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const activeNotebook = notebooks.find(({ id }) => id === activeId);
  const atLimit = !canCreateNotebook(notebooks.length);

  function selectNotebook(id: string) {
    setActiveId(id);
    setMobilePanel("conversation");
    router.replace(`/?notebook=${id}`, { scroll: false });
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(undefined), 2600);
  }

  function friendlyError(error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      if (error.message.includes("notebook_limit_reached")) {
        return `A Guest can keep up to ${NOTEBOOK_LIMIT} Notebooks.`;
      }
    }
    return "That change didn't save. Please try again.";
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNotebookTitle(title);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }
    if (atLimit) {
      setFormError(`A Guest can keep up to ${NOTEBOOK_LIMIT} Notebooks.`);
      return;
    }

    setFormError(undefined);
    startTransition(async () => {
      try {
        const created = await repository.create({
          ownerId: guestId,
          title: validation.title,
        });
        setNotebooks((current) => sortNotebooks([created, ...current]));
        setCreateOpen(false);
        setTitle("");
        selectNotebook(created.id);
        showNotice("Notebook created");
      } catch (error) {
        setFormError(friendlyError(error));
      }
    });
  }

  function openRename(notebook: Notebook) {
    setRenameTarget(notebook);
    setRenameTitle(notebook.title);
    setFormError(undefined);
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;

    const validation = validateNotebookTitle(renameTitle);
    if (!validation.ok) {
      setFormError(validation.message);
      return;
    }

    setFormError(undefined);
    startTransition(async () => {
      try {
        const renamed = await repository.rename({
          id: renameTarget.id,
          title: validation.title,
        });
        setNotebooks((current) =>
          sortNotebooks(
            current.map((notebook) =>
              notebook.id === renamed.id ? renamed : notebook,
            ),
          ),
        );
        setRenameTarget(undefined);
        showNotice("Title updated");
      } catch (error) {
        setFormError(friendlyError(error));
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        await repository.remove(deleteTarget.id);
        const remaining = notebooks.filter(({ id }) => id !== deleteTarget.id);
        setNotebooks(remaining);
        setDeleteTarget(undefined);
        if (activeId === deleteTarget.id) {
          const nextId = remaining[0]?.id;
          setActiveId(nextId);
          router.replace(nextId ? `/?notebook=${nextId}` : "/", {
            scroll: false,
          });
        }
        showNotice("Notebook deleted");
      } catch (error) {
        setFormError(friendlyError(error));
      }
    });
  }

  return (
    <main className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--line)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <BrandMark compact />
          <span className="hidden h-6 w-px bg-[var(--line)] sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {activeNotebook?.title ?? "Your research desk"}
            </p>
            <p className="hidden text-xs text-[var(--muted-light)] sm:block">
              Private Notebook
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] sm:flex">
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

      <nav
        className="flex h-12 shrink-0 border-b border-[var(--line)] bg-white/70 lg:hidden"
        aria-label="Workspace panels"
      >
        <MobileTab
          active={mobilePanel === "sources"}
          onClick={() => setMobilePanel("sources")}
          icon={FileText}
          label="Sources"
        />
        <MobileTab
          active={mobilePanel === "conversation"}
          onClick={() => setMobilePanel("conversation")}
          icon={MessageSquareText}
          label="Conversation"
        />
        <MobileTab
          active={mobilePanel === "studio"}
          onClick={() => setMobilePanel("studio")}
          icon={PanelRight}
          label="Studio"
        />
      </nav>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[286px_minmax(360px,1fr)_318px]">
        <aside
          className={cn(
            "min-h-0 flex-col border-r border-[var(--line)] bg-[var(--paper-deep)] lg:flex",
            mobilePanel === "sources" ? "flex" : "hidden",
          )}
        >
          <div className="border-b border-[var(--line)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="eyebrow">Library</p>
                <h2 className="mt-1 font-serif text-xl font-semibold">
                  Notebooks
                </h2>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
                {notebooks.length}/{NOTEBOOK_LIMIT}
              </span>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                setFormError(undefined);
                setCreateOpen(true);
              }}
              disabled={atLimit}
            >
              <Plus className="size-4" />
              New Notebook
            </Button>
            {atLimit ? (
              <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
                Guest limit reached
              </p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {notebooks.length ? (
              <div className="space-y-1">
                {notebooks.map((notebook) => (
                  <NotebookRow
                    key={notebook.id}
                    notebook={notebook}
                    active={notebook.id === activeId}
                    onSelect={() => selectNotebook(notebook.id)}
                    onRename={() => openRename(notebook)}
                    onDelete={() => {
                      setFormError(undefined);
                      setDeleteTarget(notebook);
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid h-full place-items-center px-5 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[var(--muted)] shadow-sm">
                    <FolderPlus className="size-5" />
                  </span>
                  <p className="mt-4 text-sm font-semibold">No Notebooks yet</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    Create one to begin a private collection of Sources.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--line)] p-4">
            <div className="flex items-center gap-2.5 text-xs text-[var(--muted)]">
              <span className="grid size-7 place-items-center rounded-lg bg-[var(--sage)]">
                <Check className="size-3.5 text-[var(--ink)]" />
              </span>
              <span>
                Private Guest <strong>· {displayGuestId(guestId)}</strong>
              </span>
            </div>
          </div>
        </aside>

        <section
          className={cn(
            "min-h-0 flex-col bg-[var(--paper)] lg:flex",
            mobilePanel === "conversation" ? "flex" : "hidden",
          )}
          aria-label="Conversation"
        >
          <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-[var(--muted)]" />
              <h2 className="text-sm font-semibold">Conversation</h2>
            </div>
            <span className="rounded-full bg-[var(--sage)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
              Grounded in Sources
            </span>
          </div>

          {activeNotebook ? (
            <ConversationEmpty notebook={activeNotebook} />
          ) : (
            <NoNotebook onCreate={() => setCreateOpen(true)} />
          )}
        </section>

        <aside
          className={cn(
            "min-h-0 flex-col border-l border-[var(--line)] bg-[#f7f3e9] lg:flex",
            mobilePanel === "studio" ? "flex" : "hidden",
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
              <button
                className="text-[11px] font-semibold text-[var(--muted-light)]"
                disabled
              >
                0 saved
              </button>
            </div>
            <div className="rounded-2xl border border-dashed border-[var(--line-strong)] p-5 text-center">
              <StickyNote className="mx-auto size-5 text-[var(--muted-light)]" />
              <p className="mt-3 text-xs font-semibold">No Notes yet</p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">
                Saved Answers and inspected Passages will collect here.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <CreateNotebookDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError(undefined);
        }}
        title={title}
        onTitleChange={(value) => {
          setTitle(value);
          setFormError(undefined);
        }}
        error={formError}
        pending={isPending}
        onSubmit={handleCreate}
      />

      <RenameNotebookDialog
        notebook={renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(undefined);
          setFormError(undefined);
        }}
        title={renameTitle}
        onTitleChange={(value) => {
          setRenameTitle(value);
          setFormError(undefined);
        }}
        error={formError}
        pending={isPending}
        onSubmit={handleRename}
      />

      <DeleteNotebookDialog
        notebook={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
          setFormError(undefined);
        }}
        error={formError}
        pending={isPending}
        onConfirm={handleDelete}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {notice ?? initialError}
      </div>
      {notice || initialError ? (
        <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-white shadow-xl">
          {notice ? <Check className="size-4" /> : <X className="size-4" />}
          {notice ?? initialError}
        </div>
      ) : null}
    </main>
  );
}

function NotebookRow({
  notebook,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  notebook: Notebook;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-xl pr-1 transition-colors",
        active ? "bg-white shadow-sm" : "hover:bg-white/70",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-inset"
        onClick={onSelect}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            active
              ? "bg-[var(--accent)] text-[var(--ink)]"
              : "bg-white text-[var(--muted)]",
          )}
        >
          <NotebookPen className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {notebook.title}
          </span>
          <span className="block text-[10px] text-[var(--muted-light)]">
            {formatUpdatedAt(notebook.updated_at)}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--muted-light)] opacity-70 outline-none group-hover:opacity-100 hover:bg-[var(--paper-deep)] hover:text-[var(--ink)] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
            aria-label={`Actions for ${notebook.title}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil className="size-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-[var(--danger)] data-[highlighted]:bg-[#f9ece8]"
            onSelect={onDelete}
          >
            <Trash2 className="size-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ConversationEmpty({ notebook }: { notebook: Notebook }) {
  const suggestions = [
    "What themes connect my Sources?",
    "Summarize the strongest evidence",
    "What should I investigate next?",
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="w-full max-w-xl text-center">
          <div className="relative mx-auto w-fit">
            <span className="grid size-16 place-items-center rounded-[22px] bg-[var(--sage)] text-[var(--ink)]">
              <Lightbulb className="size-6" strokeWidth={1.7} />
            </span>
            <span className="absolute -right-1 -bottom-1 size-4 rounded-full border-2 border-[var(--paper)] bg-[var(--accent)]" />
          </div>
          <p className="eyebrow mt-6">Ready for Sources</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Begin with what you know.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
            <strong className="text-[var(--ink)]">{notebook.title}</strong> is
            private and ready. Sources, grounded Answers, and validated
            Citations will appear in this three-pane desk.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                disabled
                className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-left text-xs leading-5 font-medium text-[var(--muted)] opacity-75"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="shrink-0 border-t border-[var(--line)] p-4 sm:p-5">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--line-strong)] bg-white p-2 shadow-[0_8px_28px_rgba(24,38,31,.06)]">
          <div className="flex items-center gap-2">
            <Search className="ml-2 size-4 shrink-0 text-[var(--muted-light)]" />
            <input
              disabled
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-light)]"
              placeholder="Add a Source before asking a Question"
              aria-label="Ask a Question"
            />
            <button
              disabled
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--line)] text-white"
              aria-label="Submit Question"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--muted-light)]">
          Answers will use only ready Sources in this Notebook.
        </p>
      </div>
    </div>
  );
}

function NoNotebook({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--sage)]">
          <NotebookPen className="size-6" />
        </span>
        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-[-0.04em]">
          A clear place to think.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Create a private Notebook for a question, topic, or body of research.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          <Plus className="size-4" /> Create your first Notebook
        </Button>
      </div>
    </div>
  );
}

function MobileTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Menu;
  label: string;
}) {
  return (
    <button
      className={cn(
        "relative flex flex-1 items-center justify-center gap-1.5 text-xs font-semibold text-[var(--muted)]",
        active &&
          "text-[var(--ink)] after:absolute after:right-5 after:bottom-0 after:left-5 after:h-0.5 after:rounded-full after:bg-[var(--accent-strong)]",
      )}
      onClick={onClick}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function CreateNotebookDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  error,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Notebook</DialogTitle>
          <DialogDescription>
            Name the question or subject you want to explore. You can change it
            later.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6" onSubmit={onSubmit}>
          <label
            className="mb-2 block text-xs font-semibold"
            htmlFor="new-title"
          >
            Notebook title
          </label>
          <Input
            id="new-title"
            autoFocus
            maxLength={81}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="e.g. Trustworthy AI systems"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "new-title-error" : undefined}
          />
          {error ? (
            <p
              id="new-title-error"
              className="mt-2 text-xs text-[var(--danger)]"
            >
              {error}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--muted-light)]">
              Private to this Guest · {NOTEBOOK_LIMIT} Notebook limit
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Notebook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameNotebookDialog({
  notebook,
  onOpenChange,
  title,
  onTitleChange,
  error,
  pending,
  onSubmit,
}: {
  notebook?: Notebook;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={Boolean(notebook)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Notebook</DialogTitle>
          <DialogDescription>
            A focused title makes a growing research library easier to scan.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6" onSubmit={onSubmit}>
          <label
            className="mb-2 block text-xs font-semibold"
            htmlFor="rename-title"
          >
            Notebook title
          </label>
          <Input
            id="rename-title"
            autoFocus
            maxLength={81}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "rename-title-error" : undefined}
          />
          {error ? (
            <p
              id="rename-title-error"
              className="mt-2 text-xs text-[var(--danger)]"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save title"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteNotebookDialog({
  notebook,
  onOpenChange,
  error,
  pending,
  onConfirm,
}: {
  notebook?: Notebook;
  onOpenChange: (open: boolean) => void;
  error?: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(notebook)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this Notebook?</DialogTitle>
          <DialogDescription>
            “{notebook?.title}” will be permanently removed. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="mt-4 text-xs text-[var(--danger)]">{error}</p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={pending}>
              Keep Notebook
            </Button>
          </DialogClose>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            <Trash2 className="size-4" />
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
