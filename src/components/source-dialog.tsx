"use client";

import { FormEvent } from "react";

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
import { Input } from "@/components/ui/input";
import {
  DEFAULT_APPLICATION_LIMITS,
  formatMegabytes,
  sourceInputLimits as selectSourceInputLimits,
  type SourceInputLimits,
} from "@/lib/limits";

export function AddSourceDialog({
  open,
  onOpenChange,
  title,
  content,
  kind,
  file,
  onTitleChange,
  onContentChange,
  onKindChange,
  onFileChange,
  error,
  pending,
  onSubmit,
  limits = selectSourceInputLimits(DEFAULT_APPLICATION_LIMITS),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  kind: "pasted_text" | "pdf";
  file?: File;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onKindChange: (value: "pasted_text" | "pdf") => void;
  onFileChange: (value?: File) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  limits?: SourceInputLimits;
}) {
  const errorId = "pasted-source-error";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Source</DialogTitle>
          <DialogDescription>
            Paste up to {limits.pastedTextCharacters.toLocaleString()}{" "}
            characters or upload a PDF up to {formatMegabytes(limits.pdfBytes)}{" "}
            MB and {limits.pdfPages} pages. Locations are preserved for
            Citations.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-2" aria-label="Source type">
            {(["pasted_text", "pdf"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={kind === option ? "secondary" : "ghost"}
                onClick={() => onKindChange(option)}
              >
                {option === "pdf" ? "Upload PDF" : "Paste text"}
              </Button>
            ))}
          </div>
          <div>
            <label
              className="mb-2 block text-xs font-semibold"
              htmlFor="source-title"
            >
              Source title
            </label>
            <Input
              id="source-title"
              autoFocus
              maxLength={120}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>
          {kind === "pdf" ? (
            <div>
              <label
                className="mb-2 block text-xs font-semibold"
                htmlFor="source-file"
              >
                PDF file
              </label>
              <Input
                id="source-file"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => onFileChange(event.target.files?.[0])}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : "pdf-limits"}
              />
              <p id="pdf-limits" className="mt-2 text-xs text-[var(--muted)]">
                PDF only · {formatMegabytes(limits.pdfBytes)} MB maximum ·{" "}
                {limits.pdfPages} pages maximum · password-protected and scanned
                PDFs are not supported
              </p>
              {file ? (
                <p className="mt-2 text-xs font-semibold">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="mb-2 flex justify-between gap-3 text-xs font-semibold">
                <label htmlFor="source-content">Pasted text</label>
                <span
                  className={
                    content.length > limits.pastedTextCharacters
                      ? "text-[var(--danger)]"
                      : "text-[var(--muted)]"
                  }
                >
                  {content.length.toLocaleString()} /{" "}
                  {limits.pastedTextCharacters.toLocaleString()}
                </span>
              </div>
              <textarea
                id="source-content"
                className="min-h-56 w-full resize-y rounded-xl border border-[var(--line-strong)] bg-white p-3.5 text-sm leading-6 outline-none focus:border-[var(--ink)] focus:ring-2 focus:ring-[var(--sage)]"
                value={content}
                onChange={(event) => onContentChange(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
          )}
          {error ? (
            <p
              id={errorId}
              className="text-xs text-[var(--danger)]"
              role="alert"
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
              {pending ? "Adding…" : "Add Source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
