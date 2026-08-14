"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Note } from "./model";
import { validateNoteContent } from "./model";
import type { NoteRepository } from "./repository";

export type NotesLoadState = "empty" | "loading" | "ready" | "error";

export function useNotes({
  notebookId,
  repository,
}: {
  notebookId?: string;
  repository: NoteRepository;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<NotesLoadState>(
    notebookId ? "loading" : "empty",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [failedSave, setFailedSave] = useState<{
    answerId: string;
    content: string;
  }>();
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setError(undefined);
    if (!notebookId) {
      setNotes([]);
      setStatus("empty");
      return;
    }
    setNotes([]);
    setStatus("loading");
    try {
      const loaded = await repository.list(notebookId);
      if (current !== requestId.current) return;
      setNotes(loaded);
      setStatus("ready");
    } catch {
      if (current !== requestId.current) return;
      setStatus("error");
    }
  }, [notebookId, repository]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
      requestId.current += 1;
    };
  }, [load]);

  const create = useCallback(
    async (answerId: string, content: string) => {
      if (!notebookId || pending) return undefined;
      const validation = validateNoteContent(content);
      if (!validation.ok) {
        setError(validation.message);
        return undefined;
      }
      const existing = notes.find((note) => note.origin_answer_id === answerId);
      if (existing) return existing;
      setPending(true);
      setError(undefined);
      setNotice(undefined);
      try {
        const note = await repository.saveAnswer({
          notebookId,
          answerId,
          content: validation.content,
        });
        setNotes((current) => [note, ...current]);
        setFailedSave(undefined);
        setNotice("Note saved");
        return note;
      } catch {
        setFailedSave({ answerId, content });
        setError("That Note didn’t save. Please try again.");
      } finally {
        setPending(false);
      }
    },
    [notebookId, notes, pending, repository],
  );

  const update = useCallback(
    async (id: string, value: string) => {
      const validation = validateNoteContent(value);
      if (!validation.ok) {
        setError(validation.message);
        return false;
      }
      setPending(true);
      setError(undefined);
      setNotice(undefined);
      try {
        const updated = await repository.update(id, validation.content);
        setNotes((current) =>
          current.map((note) => (note.id === id ? updated : note)),
        );
        setNotice("Note updated");
        return true;
      } catch {
        setError("That change didn’t save. Please try again.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string) => {
      setPending(true);
      setError(undefined);
      setNotice(undefined);
      try {
        await repository.remove(id);
        setNotes((current) => current.filter((note) => note.id !== id));
        setNotice("Note deleted");
        return true;
      } catch {
        setError("That Note couldn’t be deleted. Please try again.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [repository],
  );

  return {
    notes,
    status,
    pending,
    error,
    notice,
    canRetrySave: Boolean(failedSave),
    create,
    retrySave: () =>
      failedSave
        ? create(failedSave.answerId, failedSave.content)
        : Promise.resolve(undefined),
    update,
    remove,
    retry: load,
    clearError: () => setError(undefined),
  };
}
