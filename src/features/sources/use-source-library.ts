"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReadableSource } from "./model";
import type { SourceRepository } from "./repository";

export type SourceLoadState = "empty" | "loading" | "ready" | "error";

type NewSource =
  | { title: string; kind: "pasted_text"; content: string }
  | { title: string; kind: "pdf"; file: File };

export type SourceCreationFailure = {
  index: number;
  message: string;
};

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
  const advancing = useRef(new Set<string>());

  const load = useCallback(
    async (options?: { preserveSources?: boolean }) => {
      const currentRequest = ++requestId.current;
      const preserveSources = options?.preserveSources ?? false;
      if (!preserveSources) setSelectedId(undefined);

      if (!notebookId) {
        setSources([]);
        setLoadedNotebookId(undefined);
        setStatus("empty");
        return;
      }

      if (!preserveSources) setSources([]);
      setLoadedNotebookId(notebookId);
      if (!preserveSources) setStatus("loading");
      try {
        const loaded = await repository.list(notebookId);
        if (requestId.current !== currentRequest) return;
        setSources(loaded);
        setStatus("ready");
      } catch {
        if (requestId.current !== currentRequest) return;
        setStatus("error");
      }
    },
    [notebookId, repository],
  );

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

  const process = useCallback(
    async (sourceId: string) => {
      if (advancing.current.has(sourceId)) return;
      advancing.current.add(sourceId);
      try {
        await repository.advance(sourceId);
        await load({ preserveSources: true });
      } finally {
        advancing.current.delete(sourceId);
      }
    },
    [load, repository],
  );

  useEffect(() => {
    if (status !== "ready") return;
    const next = sources.find(({ processing_stage }) =>
      ["uploaded", "extracting", "chunking", "embedding"].includes(
        processing_stage,
      ),
    );
    if (next) void process(next.id);
  }, [process, sources, status]);

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
    async create(input: NewSource) {
      if (!notebookId) return;
      await repository.create({ notebookId, ...input });
      await load({ preserveSources: true });
    },
    async createMany(
      inputs: readonly NewSource[],
    ): Promise<SourceCreationFailure[]> {
      if (!notebookId || !inputs.length) return [];

      const results = await Promise.allSettled(
        inputs.map((input) => repository.create({ notebookId, ...input })),
      );
      await load({ preserveSources: true });

      return results.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              {
                index,
                message:
                  result.reason instanceof Error
                    ? result.reason.message
                    : "The Source could not be added.",
              },
            ]
          : [],
      );
    },
    process,
  };
}
