"use client";

import { X } from "lucide-react";
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
  SOURCE_TITLE_CHARACTER_LIMIT,
  sourceTitleFromPdfFilename,
} from "@/features/sources/source-title";
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
  files,
  onTitleChange,
  onContentChange,
  onKindChange,
  onFilesChange,
  error,
  pending,
  onSubmit,
  availablePdfSlots = DEFAULT_APPLICATION_LIMITS.sourcesPerNotebook,
  limits = selectSourceInputLimits(DEFAULT_APPLICATION_LIMITS),
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  kind: "pasted_text" | "pdf";
  files: readonly File[];
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onKindChange: (value: "pasted_text" | "pdf") => void;
  onFilesChange: (value: File[]) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  availablePdfSlots?: number;
  limits?: SourceInputLimits;
}) {
  const errorId = "source-error";
  const sourceCount = files.length;
  const submitLabel = pending
    ? sourceCount > 1
      ? `Adding ${sourceCount} Sources…`
      : "Adding…"
    : kind === "pdf" && sourceCount > 1
      ? `Add ${sourceCount} Sources`
      : "Add Source";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {kind === "pdf" ? "Add PDF Sources" : "Add Source"}
          </DialogTitle>
          <DialogDescription>
            Paste up to {limits.pastedTextCharacters.toLocaleString()}{" "}
            characters or upload one or more PDFs. Each PDF can be up to{" "}
            {formatMegabytes(limits.pdfBytes)} MB and {limits.pdfPages} pages.
            Locations are preserved for Citations.
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
                {option === "pdf" ? "Upload PDFs" : "Paste text"}
              </Button>
            ))}
          </div>
          {kind === "pdf" ? (
            <div>
              <label
                className="mb-2 block text-xs font-semibold"
                htmlFor="source-file"
              >
                PDF files
              </label>
              <Input
                id="source-file"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                autoFocus
                onChange={(event) => {
                  onFilesChange([
                    ...files,
                    ...Array.from(event.target.files ?? []),
                  ]);
                  event.currentTarget.value = "";
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={`pdf-limits${error ? ` ${errorId}` : ""}`}
              />
              <p id="pdf-limits" className="mt-2 text-xs text-[var(--muted)]">
                Select up to {availablePdfSlots} PDF
                {availablePdfSlots === 1 ? "" : "s"} ·{" "}
                {formatMegabytes(limits.pdfBytes)} MB and {limits.pdfPages}{" "}
                pages maximum per file · password-protected and scanned PDFs are
                not supported
              </p>
              {files.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium text-[var(--muted)]">
                    {files.length} PDF{files.length === 1 ? "" : "s"} selected.
                    Source titles are generated from filenames.
                  </p>
                  <ul
                    className="mt-2 max-h-40 space-y-2 overflow-y-auto"
                    aria-label="Generated Source titles"
                  >
                    {files.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="relative rounded-xl border border-[var(--line)] bg-white/70 py-2 pr-10 pl-3"
                      >
                        <span className="block truncate text-xs font-semibold">
                          {sourceTitleFromPdfFilename(file.name)}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                          {file.name} · {(file.size / 1024 / 1024).toFixed(1)}{" "}
                          MB
                        </span>
                        <button
                          type="button"
                          className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none disabled:opacity-50"
                          onClick={() =>
                            onFilesChange(
                              files.filter(
                                (_, fileIndex) => fileIndex !== index,
                              ),
                            )
                          }
                          disabled={pending}
                          aria-label={`Remove ${file.name}`}
                          title={`Remove ${file.name}`}
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <>
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
                  maxLength={SOURCE_TITLE_CHARACTER_LIMIT}
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                />
              </div>
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
            </>
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
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
