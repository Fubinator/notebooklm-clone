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
  const [removingId, setRemovingId] = useState<string>();
  const [removalFailedIds, setRemovalFailedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [notice, setNotice] = useState<string>();
  const requestId = useRef(0);
  const advancing = useRef(new Set<string>());
  const removalInFlight = useRef<string | undefined>(undefined);
  const deletionIntentIds = useRef(new Set<string>());
  const autoRetriedIds = useRef(new Set<string>());
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(undefined), 2600);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  useEffect(() => {
    deletionIntentIds.current.clear();
    autoRetriedIds.current.clear();
    removalInFlight.current = undefined;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setRemovingId(undefined);
      setRemovalFailedIds(new Set());
    });
    return () => {
      cancelled = true;
    };
  }, [notebookId]);

  const load = useCallback(
    async (options?: {
      preserveSources?: boolean;
    }): Promise<ReadableSource[] | undefined> => {
      const currentRequest = ++requestId.current;
      const preserveSources = options?.preserveSources ?? false;
      if (!preserveSources) setSelectedId(undefined);

      if (!notebookId) {
        setSources([]);
        setLoadedNotebookId(undefined);
        setStatus("empty");
        return [];
      }

      if (!preserveSources) setSources([]);
      setLoadedNotebookId(notebookId);
      if (!preserveSources) setStatus("loading");
      try {
        const loaded = await repository.list(notebookId);
        if (requestId.current !== currentRequest) return undefined;
        setSources(loaded);
        setRemovalFailedIds(
          (current) =>
            new Set(
              [...current].filter((id) =>
                loaded.some(
                  (source) =>
                    source.id === id && source.processing_stage === "deleting",
                ),
              ),
            ),
        );
        setStatus("ready");
        return loaded;
      } catch {
        if (requestId.current !== currentRequest) return undefined;
        setStatus("error");
        return undefined;
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
      } catch (error) {
        if (deletionIntentIds.current.has(sourceId)) {
          await load({ preserveSources: true });
          return;
        }
        throw error;
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
    if (!next) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void process(next.id).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [process, sources, status]);

  const remove = useCallback(
    async (sourceId: string) => {
      if (removalInFlight.current) return false;

      removalInFlight.current = sourceId;
      deletionIntentIds.current.add(sourceId);
      autoRetriedIds.current.add(sourceId);
      setRemovingId(sourceId);
      setRemovalFailedIds((current) => {
        const next = new Set(current);
        next.delete(sourceId);
        return next;
      });

      try {
        const result = await repository.remove(sourceId);
        if (result === "missing") {
          const refreshed = await load({ preserveSources: true });
          if (!refreshed) {
            throw new Error(
              "Source removal could not be confirmed. Try again.",
            );
          }
          if (refreshed.some(({ id }) => id === sourceId)) {
            throw new Error("That Source is not available.");
          }
        } else {
          setSources((current) => current.filter(({ id }) => id !== sourceId));
          await load({ preserveSources: true });
        }

        setSelectedId((current) =>
          current === sourceId ? undefined : current,
        );
        setRemovalFailedIds((current) => {
          const next = new Set(current);
          next.delete(sourceId);
          return next;
        });
        showNotice("Source removed");
        return true;
      } catch (error) {
        const refreshed = await load({ preserveSources: true });
        const deletionStarted = refreshed?.some(
          (source) =>
            source.id === sourceId && source.processing_stage === "deleting",
        );
        if (deletionStarted) {
          setRemovalFailedIds((current) => new Set(current).add(sourceId));
        } else {
          deletionIntentIds.current.delete(sourceId);
        }
        throw error;
      } finally {
        removalInFlight.current = undefined;
        setRemovingId(undefined);
      }
    },
    [load, repository, showNotice],
  );

  useEffect(() => {
    if (status !== "ready" || removalInFlight.current) return;
    const interrupted = sources.find(
      (source) =>
        source.processing_stage === "deleting" &&
        !autoRetriedIds.current.has(source.id),
    );
    if (!interrupted) return;
    deletionIntentIds.current.add(interrupted.id);
    autoRetriedIds.current.add(interrupted.id);
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void remove(interrupted.id).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [remove, sources, status]);

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
    removingId,
    removalFailedIds,
    notice,
    select: setSelectedId,
    retry: load,
    async create(
      input:
        | { title: string; kind: "pasted_text"; content: string }
        | { title: string; kind: "pdf"; file: File },
    ) {
      if (!notebookId) return;
      await repository.create({ notebookId, ...input });
      await load({ preserveSources: true });
    },
    process,
    remove,
  };
}
