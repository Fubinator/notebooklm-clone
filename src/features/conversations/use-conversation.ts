"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { validateQuestion, type ConversationMessage } from "./model";
import type { ConversationRepository } from "./repository";

export type ConversationLoadState = "empty" | "loading" | "ready" | "error";

export function useConversation({
  notebookId,
  repository,
}: {
  notebookId?: string;
  repository: ConversationRepository;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loadedNotebookId, setLoadedNotebookId] = useState<string>();
  const [status, setStatus] = useState<ConversationLoadState>(
    notebookId ? "loading" : "empty",
  );
  const [pendingQuestion, setPendingQuestion] = useState<string>();
  const [error, setError] = useState<string>();
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setPendingQuestion(undefined);
    setError(undefined);

    if (!notebookId) {
      setMessages([]);
      setLoadedNotebookId(undefined);
      setStatus("empty");
      return;
    }

    setMessages([]);
    setLoadedNotebookId(notebookId);
    setStatus("loading");
    try {
      const loaded = await repository.list(notebookId);
      if (requestId.current !== currentRequest) return;
      setMessages(loaded);
      setStatus("ready");
    } catch {
      if (requestId.current !== currentRequest) return;
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

  const ask = useCallback(
    async (value: string) => {
      const validation = validateQuestion(value);
      if (!validation.ok) {
        setError(validation.message);
        return false;
      }
      if (!notebookId || pendingQuestion) return false;

      setError(undefined);
      setPendingQuestion(validation.question);
      try {
        await repository.ask({
          notebookId,
          question: validation.question,
        });
        await load();
        return true;
      } catch (caught) {
        await load();
        setError(
          caught instanceof Error
            ? caught.message
            : "The Question could not be answered.",
        );
        return false;
      } finally {
        setPendingQuestion(undefined);
      }
    },
    [load, notebookId, pendingQuestion, repository],
  );

  const showsCurrentNotebook = loadedNotebookId === notebookId;

  return {
    messages: showsCurrentNotebook ? messages : [],
    pendingQuestion: showsCurrentNotebook ? pendingQuestion : undefined,
    status: !notebookId
      ? ("empty" as const)
      : showsCurrentNotebook
        ? status
        : ("loading" as const),
    error,
    ask,
    retry: load,
  };
}
