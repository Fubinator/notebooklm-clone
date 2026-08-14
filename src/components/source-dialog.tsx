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
import { PASTED_TEXT_CHARACTER_LIMIT } from "@/features/sources/source-reader";

export function AddSourceDialog({
  open,
  onOpenChange,
  title,
  content,
  onTitleChange,
  onContentChange,
  error,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const errorId = "pasted-source-error";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add pasted text</DialogTitle>
          <DialogDescription>
            Add up to {PASTED_TEXT_CHARACTER_LIMIT.toLocaleString()} characters.
            Paragraph breaks are preserved for Citations.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
          <div>
            <div className="mb-2 flex justify-between gap-3 text-xs font-semibold">
              <label htmlFor="source-content">Pasted text</label>
              <span
                className={
                  content.length > PASTED_TEXT_CHARACTER_LIMIT
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
                }
              >
                {content.length.toLocaleString()} /{" "}
                {PASTED_TEXT_CHARACTER_LIMIT.toLocaleString()}
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
