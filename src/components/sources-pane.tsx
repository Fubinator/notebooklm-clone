"use client";

import {
  AlertTriangle,
  FilePlus2,
  FileText,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { Notebook } from "@/features/notebooks/model";
import type { ReadableSource } from "@/features/sources/model";
import type { SourceLoadState } from "@/features/sources/use-source-library";
import { cn } from "@/lib/utils";

export function SourcesPane({
  visible,
  notebook,
  sources,
  status,
  selectedSourceId,
  onSelect,
  onRetry,
  onClose,
  onAdd,
  onProcess,
}: {
  visible: boolean;
  notebook?: Notebook;
  sources: ReadableSource[];
  status: SourceLoadState;
  selectedSourceId?: string;
  onSelect: (sourceId: string) => void;
  onRetry: () => void;
  onClose: () => void;
  onAdd: () => void;
  onProcess: (sourceId: string) => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (visible) drawerRef.current?.focus();
  }, [visible]);

  return (
    <aside
      ref={drawerRef}
      tabIndex={visible ? -1 : undefined}
      role={visible ? "dialog" : undefined}
      aria-modal={visible ? true : undefined}
      className={cn(
        "absolute inset-y-0 left-0 z-20 min-h-0 w-[min(88vw,360px)] flex-col border-r border-[var(--line)] bg-[var(--paper-deep)] shadow-2xl outline-none lg:static lg:z-auto lg:flex lg:w-auto lg:shadow-none",
        visible ? "flex" : "hidden",
      )}
      aria-label={visible ? "Sources drawer" : "Sources"}
      id="sources-panel"
    >
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-[var(--muted)]" />
          <h2 className="text-sm font-semibold">Sources</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
            {sources.length} / 5
          </span>
          <button
            className="rounded-lg p-1.5 text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none lg:hidden"
            aria-label="Close Sources drawer"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Button
          className="w-full"
          disabled={!notebook || notebook.is_example || sources.length >= 5}
          onClick={onAdd}
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
            onProcess={onProcess}
          />
        </div>
        {notebook ? (
          <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3 text-[11px] leading-4 text-[var(--muted)]">
            {notebook.is_example
              ? "Shared with every Guest · Content and Passages are immutable"
              : "Up to 5 Sources · Pasted text up to 50,000 characters"}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SourceListState({
  notebook,
  sources,
  status,
  selectedSourceId,
  onSelect,
  onRetry,
  onProcess,
}: {
  notebook?: Notebook;
  sources: ReadableSource[];
  status: SourceLoadState;
  selectedSourceId?: string;
  onSelect: (sourceId: string) => void;
  onRetry: () => void;
  onProcess: (sourceId: string) => void;
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
        <div
          key={source.id}
          className={cn(
            "rounded-xl border bg-white p-3",
            selectedSourceId === source.id
              ? "border-[var(--accent-strong)]"
              : "border-[var(--line)]",
          )}
        >
          <button
            className="w-full rounded-lg text-left focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none"
            onClick={() => onSelect(source.id)}
            aria-label={`Preview ${source.title}`}
          >
            <span className="flex items-start gap-2.5">
              {source.processing_stage === "failed" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
              ) : (
                <FileText className="mt-0.5 size-4 shrink-0 text-[var(--accent-strong)]" />
              )}
              <span className="min-w-0">
                <span className="block text-xs leading-5 font-semibold">
                  {source.title}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[var(--muted)]">
                  {stageLabel(source.processing_stage)} ·{" "}
                  {source.passages.length} Passages ·{" "}
                  {source.kind === "pasted_text" ? "Pasted text" : "PDF"}
                </span>
              </span>
            </span>
          </button>
          {source.processing_stage === "failed" ? (
            <Button
              className="mt-2 w-full"
              size="sm"
              variant="secondary"
              onClick={() => onProcess(source.id)}
            >
              <RefreshCw className="size-3.5" /> Retry processing
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function stageLabel(stage: ReadableSource["processing_stage"]) {
  return (
    {
      uploaded: "Uploaded",
      extracting: "Extracting",
      chunking: "Building Passages",
      embedding: "Embedding",
      ready: "Ready",
      failed: "Processing failed",
    } as const
  )[stage];
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
