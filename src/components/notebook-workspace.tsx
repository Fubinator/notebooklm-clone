"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CreateNotebookDialog,
  DeleteNotebookDialog,
  RenameNotebookDialog,
} from "@/components/notebook-dialogs";
import { NotebookHeader } from "@/components/notebook-header";
import {
  type MobilePanel,
  WorkspacePanelTabs,
} from "@/components/workspace-panes";
import { ConversationPane } from "@/components/conversation-pane";
import { SourcesPane } from "@/components/sources-pane";
import { StudioPane, type StudioView } from "@/components/studio-pane";
import type { Citation } from "@/features/conversations/model";
import { createConversationRepository } from "@/features/conversations/repository";
import { useConversation } from "@/features/conversations/use-conversation";
import type { Notebook } from "@/features/notebooks/model";
import { createNotebookRepository } from "@/features/notebooks/repository";
import { useNotebookWorkspace } from "@/features/notebooks/use-notebook-workspace";
import { createNoteRepository } from "@/features/notes/repository";
import { useNotes } from "@/features/notes/use-notes";
import { createSourceRepository } from "@/features/sources/repository";
import { useSourceLibrary } from "@/features/sources/use-source-library";

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
  const sourceRepository = useMemo(() => createSourceRepository(), []);
  const conversationRepository = useMemo(
    () => createConversationRepository(),
    [],
  );
  const noteRepository = useMemo(
    () => createNoteRepository(guestId),
    [guestId],
  );
  const navigate = useCallback(
    (notebookId?: string) =>
      router.replace(notebookId ? `/?notebook=${notebookId}` : "/", {
        scroll: false,
      }),
    [router],
  );
  const workspace = useNotebookWorkspace({
    guestId,
    initialNotebooks,
    initialActiveId,
    repository,
    navigate,
  });
  const sourceLibrary = useSourceLibrary({
    notebookId: workspace.activeNotebook?.id,
    repository: sourceRepository,
  });
  const conversation = useConversation({
    notebookId: workspace.activeNotebook?.id,
    repository: conversationRepository,
  });
  const notes = useNotes({
    notebookId: workspace.activeNotebook?.id,
    repository: noteRepository,
  });

  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("conversation");
  const [selectedCitation, setSelectedCitation] = useState<Citation>();
  const [studioView, setStudioView] = useState<StudioView>("notes");
  const [selectedNoteId, setSelectedNoteId] = useState<string>();
  const [savingAnswerId, setSavingAnswerId] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Notebook>();
  const [deleteTarget, setDeleteTarget] = useState<Notebook>();
  const [title, setTitle] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [formError, setFormError] = useState<string>();
  const previousMobilePanel = useRef<MobilePanel>("conversation");

  useEffect(() => {
    const previous = previousMobilePanel.current;
    previousMobilePanel.current = mobilePanel;
    if (mobilePanel === "conversation" && previous !== "conversation") {
      document
        .querySelector<HTMLElement>(
          `[aria-controls="${previous === "sources" ? "sources" : "studio"}-panel"]`,
        )
        ?.focus();
    }
    if (mobilePanel === "conversation") return;
    function handleDrawerKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobilePanel("conversation");
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = document.getElementById(
        mobilePanel === "sources" ? "sources-panel" : "studio-panel",
      );
      const focusable = Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleDrawerKey);
    return () => document.removeEventListener("keydown", handleDrawerKey);
  }, [mobilePanel]);

  function openCreate() {
    setFormError(undefined);
    setTitle("");
    setCreateOpen(true);
  }

  function openRename() {
    if (!workspace.activeNotebook) return;
    setFormError(undefined);
    setRenameTitle(workspace.activeNotebook.title);
    setRenameTarget(workspace.activeNotebook);
  }

  function openDelete() {
    if (!workspace.activeNotebook) return;
    setFormError(undefined);
    setDeleteTarget(workspace.activeNotebook);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await workspace.create(title);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setCreateOpen(false);
    setTitle("");
    setSelectedCitation(undefined);
    setMobilePanel("conversation");
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameTarget) return;
    const result = await workspace.rename(renameTarget.id, renameTitle);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setRenameTarget(undefined);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await workspace.remove(deleteTarget.id);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setDeleteTarget(undefined);
    setSelectedCitation(undefined);
  }

  return (
    <main className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <NotebookHeader
        guestId={guestId}
        notebooks={workspace.notebooks}
        activeNotebook={workspace.activeNotebook}
        atLimit={workspace.atLimit}
        onSelect={(id) => {
          workspace.select(id);
          setSelectedCitation(undefined);
          setMobilePanel("conversation");
        }}
        onCreate={openCreate}
        onRename={openRename}
        onDelete={openDelete}
      />

      <WorkspacePanelTabs active={mobilePanel} onChange={setMobilePanel} />

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[286px_minmax(360px,1fr)_318px]">
        {mobilePanel !== "conversation" ? (
          <button
            className="absolute inset-0 z-10 bg-[var(--ink)]/25 lg:hidden"
            aria-label={`Close ${mobilePanel === "sources" ? "Sources" : "Context"} drawer`}
            onClick={() => setMobilePanel("conversation")}
          />
        ) : null}
        <SourcesPane
          visible={mobilePanel === "sources"}
          notebook={workspace.activeNotebook}
          sources={sourceLibrary.sources}
          status={sourceLibrary.status}
          selectedSourceId={sourceLibrary.selectedId}
          onSelect={(sourceId) => {
            sourceLibrary.select(sourceId);
            setMobilePanel("conversation");
          }}
          onRetry={() => void sourceLibrary.retry()}
          onClose={() => setMobilePanel("conversation")}
        />
        <ConversationPane
          visible
          notebook={workspace.activeNotebook}
          source={sourceLibrary.selectedSource}
          messages={conversation.messages}
          status={conversation.status}
          pendingQuestion={conversation.pendingQuestion}
          error={conversation.error}
          canAsk={
            sourceLibrary.status === "ready" &&
            sourceLibrary.sources.some(
              ({ processing_stage }) => processing_stage === "ready",
            )
          }
          onCloseSource={() => sourceLibrary.select(undefined)}
          onCreate={openCreate}
          onAsk={conversation.ask}
          onRetry={() => void conversation.retry()}
          onCitation={(citation) => {
            setSelectedCitation(citation);
            setStudioView("citation");
            setMobilePanel("studio");
          }}
          savedAnswerIds={
            new Set(notes.notes.map(({ origin_answer_id }) => origin_answer_id))
          }
          savingAnswerId={savingAnswerId}
          onSaveAnswer={(answer) => {
            setSavingAnswerId(answer.id);
            void notes.create(answer.id, answer.content).then((note) => {
              if (note) {
                setSelectedNoteId(note.id);
                setStudioView("notes");
                setMobilePanel("studio");
              }
              if (!note) {
                setStudioView("notes");
                setMobilePanel("studio");
              }
              setSavingAnswerId(undefined);
            });
          }}
        />
        <StudioPane
          visible={mobilePanel === "studio"}
          citation={selectedCitation}
          onCloseCitation={() => setSelectedCitation(undefined)}
          view={studioView}
          onViewChange={setStudioView}
          notes={notes.notes}
          notesStatus={notes.status}
          selectedNoteId={selectedNoteId}
          notesPending={notes.pending}
          notesError={notes.error}
          onSelectNote={setSelectedNoteId}
          onUpdateNote={notes.update}
          onDeleteNote={notes.remove}
          onRetryNotes={() => void notes.retry()}
          canRetrySave={notes.canRetrySave}
          onRetrySave={() => void notes.retrySave()}
          onClose={() => setMobilePanel("conversation")}
        />
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
        pending={workspace.pending}
        onSubmit={(event) => void handleCreate(event)}
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
        pending={workspace.pending}
        onSubmit={(event) => void handleRename(event)}
      />

      <DeleteNotebookDialog
        notebook={deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
          setFormError(undefined);
        }}
        error={formError}
        pending={workspace.pending}
        onConfirm={() => void handleDelete()}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {notes.notice ?? workspace.notice ?? initialError}
      </div>
      {notes.notice || workspace.notice || initialError ? (
        <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-white shadow-xl">
          {notes.notice || workspace.notice ? (
            <Check className="size-4" />
          ) : (
            <X className="size-4" />
          )}
          {notes.notice ?? workspace.notice ?? initialError}
        </div>
      ) : null}
    </main>
  );
}
