"use client";

import { LoaderCircle, Trash2 } from "lucide-react";

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
import type { ReadableSource } from "@/features/sources/model";

export function RemoveSourceDialog({
  source,
  error,
  pending,
  onOpenChange,
  onConfirm,
}: {
  source?: ReadableSource;
  error?: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={Boolean(source)}
      onOpenChange={(open) => {
        if (!pending) onOpenChange(open);
      }}
    >
      <DialogContent closeDisabled={pending}>
        <DialogHeader>
          <DialogTitle>Remove this Source?</DialogTitle>
          <DialogDescription>
            “{source?.title}” and its uploaded file or pasted content and
            searchable Passages will be permanently removed. Past Answers and
            Notes will remain, but their Citations cannot open the original
            Passage. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p
            className="mt-4 text-xs font-semibold text-[var(--danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button autoFocus variant="ghost" disabled={pending}>
              Keep Source
            </Button>
          </DialogClose>
          <Button variant="danger" disabled={pending} onClick={onConfirm}>
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {pending ? "Removing…" : error ? "Retry removal" : "Remove source"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
