"use client";

import { Trash2 } from "lucide-react";
import { FormEvent, ReactNode } from "react";

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
import { type Notebook } from "@/features/notebooks/model";
import { DEFAULT_APPLICATION_LIMITS } from "@/lib/limits";

type TitleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (value: string) => void;
  error?: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateNotebookDialog(
  props: TitleDialogProps & { notebookLimit?: number },
) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Notebook</DialogTitle>
          <DialogDescription>
            Name the question or subject you want to explore. You can change it
            later.
          </DialogDescription>
        </DialogHeader>
        <NotebookTitleForm
          {...props}
          id="new-title"
          placeholder="e.g. Trustworthy AI systems"
          submitLabel="Create Notebook"
          pendingLabel="Creating…"
          hint={
            <>
              Private to this Guest ·{" "}
              {props.notebookLimit ??
                DEFAULT_APPLICATION_LIMITS.notebooksPerGuest}{" "}
              Notebook limit
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}

export function RenameNotebookDialog({
  notebook,
  ...props
}: Omit<TitleDialogProps, "open"> & { notebook?: Notebook }) {
  return (
    <Dialog open={Boolean(notebook)} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Notebook</DialogTitle>
          <DialogDescription>
            A focused title makes a growing set of Notebooks easier to scan.
          </DialogDescription>
        </DialogHeader>
        <NotebookTitleForm
          {...props}
          open={Boolean(notebook)}
          id="rename-title"
          submitLabel="Save title"
          pendingLabel="Saving…"
        />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteNotebookDialog({
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

function NotebookTitleForm({
  id,
  title,
  onTitleChange,
  error,
  pending,
  onSubmit,
  placeholder,
  submitLabel,
  pendingLabel,
  hint,
}: TitleDialogProps & {
  id: string;
  placeholder?: string;
  submitLabel: string;
  pendingLabel: string;
  hint?: ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <form className="mt-6" onSubmit={onSubmit}>
      <label className="mb-2 block text-xs font-semibold" htmlFor={id}>
        Notebook title
      </label>
      <Input
        id={id}
        autoFocus
        maxLength={81}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <p id={errorId} className="mt-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-[var(--muted-light)]">{hint}</p>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
