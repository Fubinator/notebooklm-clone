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
import { AddSourceDialog } from "@/components/source-dialog";
import { RemoveSourceDialog } from "@/components/source-removal-dialog";
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
import type { ReadableSource } from "@/features/sources/model";
import { validatePastedText } from "@/features/sources/source-reader";
import { sourceTitleFromPdfFilename } from "@/features/sources/source-title";
import { useSourceLibrary } from "@/features/sources/use-source-library";
import {
  DEFAULT_APPLICATION_LIMITS,
  formatMegabytes,
  sourceInputLimits,
  type ApplicationLimits,
} from "@/lib/limits";

type WorkspaceProps = {
  guestId: string;
  initialNotebooks: Notebook[];
  initialActiveId?: string;
  initialError?: string;
  limits?: ApplicationLimits;
};

export function NotebookWorkspace({
  guestId,
  initialNotebooks,
  initialActiveId,
  initialError,
  limits = DEFAULT_APPLICATION_LIMITS,
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
    initialNotebooks,
    initialActiveId,
    repository,
    navigate,
    notebookLimit: limits.notebooksPerGuest,
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
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceKind, setSourceKind] = useState<"pasted_text" | "pdf">(
    "pasted_text",
  );
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceError, setSourceError] = useState<string>();
  const [sourcePending, setSourcePending] = useState(false);
  const [sourceRemovalTarget, setSourceRemovalTarget] =
    useState<ReadableSource>();
  const [sourceRemovalError, setSourceRemovalError] = useState<string>();
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

  function openSourceRemoval(source: ReadableSource) {
    if (workspace.activeNotebook?.is_example) return;
    setSourceRemovalError(undefined);
    setSourceRemovalTarget(source);
  }

  function focusAfterSourceRemoval(sourceId: string) {
    const removedIndex = sourceLibrary.sources.findIndex(
      ({ id }) => id === sourceId,
    );
    const remaining = sourceLibrary.sources.filter(({ id }) => id !== sourceId);
    const focusId =
      remaining[Math.min(Math.max(removedIndex, 0), remaining.length - 1)]?.id;
    setMobilePanel("sources");
    window.setTimeout(() => {
      const nextSource = focusId
        ? document.querySelector<HTMLElement>(
            `[data-source-preview="${focusId}"]`,
          )
        : undefined;
      (nextSource ?? document.getElementById("sources-heading"))?.focus();
    });
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

  function handleSourceOpenChange(open: boolean) {
    if (!open) {
      setSourceTitle("");
      setSourceContent("");
      setSourceFiles([]);
      setSourceError(undefined);
    }
    setSourceOpen(open);
  }

  async function handleAddSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const availableSourceSlots = Math.max(
      0,
      limits.sourcesPerNotebook - sourceLibrary.sources.length,
    );

    if (sourceKind === "pasted_text") {
      if (!sourceTitle.trim())
        return setSourceError("Enter a title for this Source.");
      const validation = validatePastedText(
        sourceContent,
        limits.pastedTextCharacters,
      );
      if (!validation.ok) return setSourceError(validation.message);
    } else {
      if (!sourceFiles.length)
        return setSourceError("Choose one or more PDFs to upload.");
      if (sourceFiles.length > availableSourceSlots)
        return setSourceError(
          `This Notebook has room for ${availableSourceSlots} more Source${availableSourceSlots === 1 ? "" : "s"}.`,
        );
      const oversizedFile = sourceFiles.find(
        (file) => file.size > limits.pdfBytes,
      );
      if (oversizedFile)
        return setSourceError(
          `${oversizedFile.name} must be ${formatMegabytes(limits.pdfBytes)} MB or smaller.`,
        );
    }

    setSourcePending(true);
    try {
      if (sourceKind === "pdf") {
        const failures = await sourceLibrary.createMany(
          sourceFiles.map((file) => ({
            title: sourceTitleFromPdfFilename(file.name),
            kind: "pdf" as const,
            file,
          })),
        );
        if (failures.length) {
          const failedFiles = failures.map(({ index }) => sourceFiles[index]!);
          const succeeded = sourceFiles.length - failures.length;
          const firstFailure = failures[0]!;
          const firstFailedFile = sourceFiles[firstFailure.index]!;
          setSourceFiles(failedFiles);
          setSourceError(
            succeeded
              ? `${succeeded} of ${sourceFiles.length} PDFs added. The PDFs that failed remain selected. ${firstFailedFile.name}: ${firstFailure.message}`
              : `${firstFailedFile.name}: ${firstFailure.message}`,
          );
          return;
        }
      } else {
        const validation = validatePastedText(
          sourceContent,
          limits.pastedTextCharacters,
        );
        await sourceLibrary.create({
          title: sourceTitle,
          kind: "pasted_text",
          content: validation.content!,
        });
      }
      handleSourceOpenChange(false);
    } catch (error) {
      setSourceError(
        error instanceof Error
          ? error.message
          : "The Source could not be added.",
      );
    } finally {
      setSourcePending(false);
    }
  }

  async function handleSourceRemoval() {
    if (!sourceRemovalTarget) return;
    const sourceId = sourceRemovalTarget.id;
    setSourceRemovalError(undefined);
    try {
      if (!(await sourceLibrary.remove(sourceId))) return;
      setSourceRemovalTarget(undefined);
      focusAfterSourceRemoval(sourceId);
    } catch (error) {
      setSourceRemovalError(
        error instanceof Error
          ? error.message
          : "Source removal did not finish. Try again.",
      );
    }
  }

  async function retrySourceRemoval(sourceId: string) {
    try {
      if (!(await sourceLibrary.remove(sourceId))) return;
      if (sourceRemovalTarget?.id === sourceId) {
        setSourceRemovalTarget(undefined);
        setSourceRemovalError(undefined);
      }
      focusAfterSourceRemoval(sourceId);
    } catch (error) {
      if (sourceRemovalTarget?.id === sourceId) {
        setSourceRemovalError(
          error instanceof Error
            ? error.message
            : "Source removal did not finish. Try again.",
        );
      }
    }
  }

  return (
    <main className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <NotebookHeader
        guestId={guestId}
        notebooks={workspace.notebooks}
        activeNotebook={workspace.activeNotebook}
        atLimit={workspace.atLimit}
        notebookLimit={limits.notebooksPerGuest}
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
          onAdd={() => {
            setSourceError(undefined);
            setSourceOpen(true);
          }}
          onProcess={(sourceId) => void sourceLibrary.process(sourceId)}
          onRemove={openSourceRemoval}
          onRetryRemoval={(sourceId) => void retrySourceRemoval(sourceId)}
          removingSourceId={sourceLibrary.removingId}
          removalFailedIds={sourceLibrary.removalFailedIds}
          sourceLimit={limits.sourcesPerNotebook}
          ingestionLimit={limits.concurrentIngestionsPerGuest}
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
              ({ id, processing_stage }) =>
                processing_stage === "ready" && id !== sourceLibrary.removingId,
            )
          }
          onCloseSource={() => sourceLibrary.select(undefined)}
          removingSourceId={sourceLibrary.removingId}
          removalFailedIds={sourceLibrary.removalFailedIds}
          onRemoveSource={openSourceRemoval}
          onRetrySourceRemoval={(sourceId) => void retrySourceRemoval(sourceId)}
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
          dailyQuestionLimit={limits.questionsPerGuestPerUtcDay}
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
        notebookLimit={limits.notebooksPerGuest}
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

      <AddSourceDialog
        open={sourceOpen}
        onOpenChange={handleSourceOpenChange}
        title={sourceTitle}
        content={sourceContent}
        kind={sourceKind}
        files={sourceFiles}
        onTitleChange={(value) => {
          setSourceTitle(value);
          setSourceError(undefined);
        }}
        onContentChange={(value) => {
          setSourceContent(value);
          setSourceError(undefined);
        }}
        onKindChange={(value) => {
          setSourceKind(value);
          setSourceError(undefined);
        }}
        onFilesChange={(value) => {
          setSourceFiles(value);
          setSourceError(undefined);
        }}
        onFileError={setSourceError}
        error={sourceError}
        pending={sourcePending}
        onSubmit={(event) => void handleAddSource(event)}
        availablePdfSlots={Math.max(
          0,
          limits.sourcesPerNotebook - sourceLibrary.sources.length,
        )}
        limits={sourceInputLimits(limits)}
      />

      <RemoveSourceDialog
        source={sourceRemovalTarget}
        onOpenChange={(open) => {
          if (!open) setSourceRemovalTarget(undefined);
          setSourceRemovalError(undefined);
        }}
        error={sourceRemovalError}
        pending={sourceLibrary.removingId === sourceRemovalTarget?.id}
        onConfirm={() => void handleSourceRemoval()}
      />

      <div className="sr-only" role="status" aria-live="polite">
        {notes.notice ??
          sourceLibrary.notice ??
          workspace.notice ??
          initialError}
      </div>
      {notes.notice ||
      sourceLibrary.notice ||
      workspace.notice ||
      initialError ? (
        <div className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-medium text-white shadow-xl">
          {notes.notice || sourceLibrary.notice || workspace.notice ? (
            <Check className="size-4" />
          ) : (
            <X className="size-4" />
          )}
          {notes.notice ??
            sourceLibrary.notice ??
            workspace.notice ??
            initialError}
        </div>
      ) : null}
    </main>
  );
}
