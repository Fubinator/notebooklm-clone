"use client";

import {
  BookOpen,
  FilePlus2,
  FileText,
  LoaderCircle,
  MessageSquareText,
  PanelRight,
  RefreshCw,
  Sparkles,
  StickyNote,
} from "lucide-react";

import { CitationInspector } from "@/components/citation-inspector";
import { ConversationView } from "@/components/conversation-view";
import { Button } from "@/components/ui/button";
import { SourcePreview } from "@/components/source-preview";
import type {
  Citation,
  ConversationMessage,
} from "@/features/conversations/model";
import type { ConversationLoadState } from "@/features/conversations/use-conversation";
import type { Notebook } from "@/features/notebooks/model";
import type { ReadableSource } from "@/features/sources/model";
import type { SourceLoadState } from "@/features/sources/use-source-library";
import { cn } from "@/lib/utils";

export type MobilePanel = "sources" | "conversation" | "studio";

export function WorkspacePanelTabs({
  active,
  onChange,
}: {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
}) {
  return (
    <nav
      className="flex h-12 shrink-0 border-b border-[var(--line)] bg-white/70 lg:hidden"
      aria-label="Workspace panels"
    >
      <MobileTab
        active={active === "sources"}
        onClick={() => onChange("sources")}
        icon={FileText}
        label="Sources"
      />
      <MobileTab
        active={active === "conversation"}
        onClick={() => onChange("conversation")}
        icon={MessageSquareText}
        label="Conversation"
      />
      <MobileTab
        active={active === "studio"}
        onClick={() => onChange("studio")}
        icon={PanelRight}
        label="Studio"
      />
    </nav>
  );
}

export function SourcesPane({
  visible,
  notebook,
  sources,
  status,
  selectedSourceId,
  onSelect,
  onRetry,
}: {
  visible: boolean;
  notebook?: Notebook;
  sources: ReadableSource[];
  status: SourceLoadState;
  selectedSourceId?: string;
  onSelect: (sourceId: string) => void;
  onRetry: () => void;
}) {
  return (
    <aside
      className={cn(
        "min-h-0 flex-col border-r border-[var(--line)] bg-[var(--paper-deep)] lg:flex",
        visible ? "flex" : "hidden",
      )}
      aria-label="Sources"
    >
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-[var(--muted)]" />
          <h2 className="text-sm font-semibold">Sources</h2>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
          {sources.length} / 5
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Button
          className="w-full"
          disabled
          aria-describedby={
            notebook?.is_example ? "example-sources-read-only" : undefined
          }
        >
          <FilePlus2 className="size-4" />
          Add Source
        </Button>
        {notebook?.is_example ? (
          <p
            id="example-sources-read-only"
            className="mt-2 px-1 text-xs leading-4 font-medium text-red-700"
          >
            Sources in the Example Notebook are read-only.
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          <SourceListState
            notebook={notebook}
            sources={sources}
            status={status}
            selectedSourceId={selectedSourceId}
            onSelect={onSelect}
            onRetry={onRetry}
          />
        </div>
        {notebook ? (
          <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3 text-[11px] leading-4 text-[var(--muted)]">
            {notebook.is_example
              ? "Shared with every Guest · Content and Passages are immutable"
              : "Up to 5 Sources per Notebook · 10 MB per PDF"}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function ConversationPane({
  visible,
  notebook,
  source,
  messages,
  status,
  pendingQuestion,
  error,
  canAsk,
  onCloseSource,
  onCreate,
  onAsk,
  onRetry,
  onCitation,
}: {
  visible: boolean;
  notebook?: Notebook;
  source?: ReadableSource;
  messages: ConversationMessage[];
  status: ConversationLoadState;
  pendingQuestion?: string;
  error?: string;
  canAsk: boolean;
  onCloseSource: () => void;
  onCreate: () => void;
  onAsk: (question: string) => Promise<boolean>;
  onRetry: () => void;
  onCitation: (citation: Citation) => void;
}) {
  return (
    <section
      className={cn(
        "min-h-0 flex-col bg-[var(--paper)] lg:flex",
        visible ? "flex" : "hidden",
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
      {source ? (
        <SourcePreview source={source} onClose={onCloseSource} />
      ) : notebook ? (
        <ConversationView
          key={notebook.id}
          notebook={notebook}
          messages={messages}
          status={status}
          pendingQuestion={pendingQuestion}
          error={error}
          canAsk={canAsk}
          onAsk={onAsk}
          onRetry={onRetry}
          onCitation={onCitation}
        />
      ) : (
        <NoNotebook onCreate={onCreate} />
      )}
    </section>
  );
}

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

function SourceListState({
  notebook,
  sources,
  status,
  selectedSourceId,
  onSelect,
  onRetry,
}: {
  notebook?: Notebook;
  sources: ReadableSource[];
  status: SourceLoadState;
  selectedSourceId?: string;
  onSelect: (sourceId: string) => void;
  onRetry: () => void;
}) {
  if (!notebook) {
    return (
      <SourceEmpty
        title="Choose a Notebook"
        message="Sources belong to the active Notebook."
      />
    );
  }

  if (status === "loading") {
    return (
      <div
        className="grid h-full min-h-48 place-items-center px-3 text-center"
        role="status"
      >
        <div>
          <LoaderCircle className="mx-auto size-5 animate-spin text-[var(--accent-strong)]" />
          <p className="mt-3 text-sm font-semibold">Loading Sources…</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Opening the readable research material.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="grid h-full min-h-48 place-items-center px-3 text-center"
        role="alert"
      >
        <div>
          <p className="text-sm font-semibold">Sources couldn’t load</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            Your Notebook is still available. Try loading its Sources again.
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="secondary"
            onClick={onRetry}
          >
            <RefreshCw className="size-3.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!sources.length) {
    return (
      <SourceEmpty
        title="No Sources yet"
        message="PDF and pasted-text Sources will collect here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <button
          key={source.id}
          className={cn(
            "w-full rounded-xl border bg-white p-3 text-left transition-colors hover:border-[var(--line-strong)]",
            selectedSourceId === source.id
              ? "border-[var(--accent-strong)]"
              : "border-[var(--line)]",
          )}
          onClick={() => onSelect(source.id)}
          aria-label={`Preview ${source.title}`}
        >
          <span className="flex items-start gap-2.5">
            <FileText className="mt-0.5 size-4 shrink-0 text-[var(--accent-strong)]" />
            <span className="min-w-0">
              <span className="block text-xs leading-5 font-semibold">
                {source.title}
              </span>
              <span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">
                Ready · {source.passages.length} Passages · PDF
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function SourceEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="grid h-full min-h-48 place-items-center px-3 text-center">
      <div>
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-[var(--muted)] shadow-sm">
          <FileText className="size-5" />
        </span>
        <p className="mt-4 text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{message}</p>
      </div>
    </div>
  );
}

function NoNotebook({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--sage)]">
          <FileText className="size-6" />
        </span>
        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-[-0.04em]">
          A clear place to think.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Create a private Notebook for a Question, topic, or body of research.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          Create your first Notebook
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
  icon: typeof FileText;
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
