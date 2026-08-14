"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReadableSource } from "./model";
import type { SourceRepository } from "./repository";

export type SourceLoadState = "empty" | "loading" | "ready" | "error";

export function useSourceLibrary({
  notebookId,
  repository,
}: {
  notebookId?: string;
  repository: SourceRepository;
}) {
  const [sources, setSources] = useState<ReadableSource[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [loadedNotebookId, setLoadedNotebookId] = useState<string>();
  const [status, setStatus] = useState<SourceLoadState>(
    notebookId ? "loading" : "empty",
  );
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setSelectedId(undefined);

    if (!notebookId) {
      setSources([]);
      setLoadedNotebookId(undefined);
      setStatus("empty");
      return;
    }

    setSources([]);
    setLoadedNotebookId(notebookId);
    setStatus("loading");
    try {
      const loaded = await repository.list(notebookId);
      if (requestId.current !== currentRequest) return;
      setSources(loaded);
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

  const showsCurrentNotebook = loadedNotebookId === notebookId;
  const visibleSources = showsCurrentNotebook ? sources : [];
  const visibleStatus = !notebookId
    ? "empty"
    : showsCurrentNotebook
      ? status
      : "loading";

  return {
    sources: visibleSources,
    selectedSource: visibleSources.find(({ id }) => id === selectedId),
    selectedId,
    status: visibleStatus,
    select: setSelectedId,
    retry: load,
  };
}
