"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  canCreateNotebook,
  NOTEBOOK_LIMIT,
  type Notebook,
  sortNotebooks,
  validateNotebookTitle,
} from "./model";
import type { NotebookRepository } from "./repository";

export type NotebookActionResult =
  { ok: true } | { ok: false; message: string };

type NotebookWorkspaceOptions = {
  initialNotebooks: Notebook[];
  initialActiveId?: string;
  repository: NotebookRepository;
  navigate: (notebookId?: string) => void;
  notebookLimit?: number;
};

export function useNotebookWorkspace({
  initialNotebooks,
  initialActiveId,
  repository,
  navigate,
  notebookLimit = NOTEBOOK_LIMIT,
}: NotebookWorkspaceOptions) {
  const [notebooks, setNotebooks] = useState(() =>
    sortNotebooks(initialNotebooks),
  );
  const [activeId, setActiveId] = useState(
    initialActiveId && initialNotebooks.some(({ id }) => id === initialActiveId)
      ? initialActiveId
      : sortNotebooks(initialNotebooks)[0]?.id,
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(undefined), 2600);
  }, []);

  const select = useCallback(
    (id: string) => {
      setActiveId(id);
      navigate(id);
    },
    [navigate],
  );

  const create = useCallback(
    async (value: string): Promise<NotebookActionResult> => {
      const validation = validateNotebookTitle(value);
      if (!validation.ok) return validation;
      const privateNotebookCount = notebooks.filter(
        ({ is_example }) => !is_example,
      ).length;
      if (!canCreateNotebook(privateNotebookCount, notebookLimit)) {
        return {
          ok: false,
          message: `A Guest can keep up to ${notebookLimit} Notebooks.`,
        };
      }

      setPending(true);
      try {
        const created = await repository.create({ title: validation.title });
        setNotebooks((current) => sortNotebooks([created, ...current]));
        setActiveId(created.id);
        navigate(created.id);
        showNotice("Notebook created");
        return { ok: true };
      } catch (error) {
        return { ok: false, message: friendlyError(error) };
      } finally {
        setPending(false);
      }
    },
    [navigate, notebookLimit, notebooks, repository, showNotice],
  );

  const rename = useCallback(
    async (id: string, value: string): Promise<NotebookActionResult> => {
      if (notebooks.find((notebook) => notebook.id === id)?.is_example) {
        return { ok: false, message: "The Example Notebook is read-only." };
      }

      const validation = validateNotebookTitle(value);
      if (!validation.ok) return validation;

      setPending(true);
      try {
        const renamed = await repository.rename({
          id,
          title: validation.title,
        });
        setNotebooks((current) =>
          sortNotebooks(
            current.map((notebook) =>
              notebook.id === renamed.id ? renamed : notebook,
            ),
          ),
        );
        showNotice("Title updated");
        return { ok: true };
      } catch (error) {
        return { ok: false, message: friendlyError(error) };
      } finally {
        setPending(false);
      }
    },
    [notebooks, repository, showNotice],
  );

  const remove = useCallback(
    async (id: string): Promise<NotebookActionResult> => {
      if (notebooks.find((notebook) => notebook.id === id)?.is_example) {
        return { ok: false, message: "The Example Notebook is read-only." };
      }

      setPending(true);
      try {
        await repository.remove(id);
        const remaining = notebooks.filter((notebook) => notebook.id !== id);
        setNotebooks(remaining);

        if (activeId === id) {
          const nextId = remaining[0]?.id;
          setActiveId(nextId);
          navigate(nextId);
        }

        showNotice("Notebook deleted");
        return { ok: true };
      } catch (error) {
        return { ok: false, message: friendlyRemovalError(error) };
      } finally {
        setPending(false);
      }
    },
    [activeId, navigate, notebooks, repository, showNotice],
  );

  return {
    notebooks,
    activeNotebook: notebooks.find(({ id }) => id === activeId),
    atLimit: !canCreateNotebook(
      notebooks.filter(({ is_example }) => !is_example).length,
      notebookLimit,
    ),
    pending,
    notice,
    select,
    create,
    rename,
    remove,
  };
}

function friendlyError(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.includes("notebook_limit_reached")
  ) {
    return `A Guest can keep up to ${NOTEBOOK_LIMIT} Notebooks.`;
  }

  return "That change didn't save. Please try again.";
}

function friendlyRemovalError(error: unknown) {
  if (error instanceof Error && error.message.includes("Notebook removal")) {
    return error.message;
  }
  if (
    error instanceof Error &&
    error.message.includes("Notebook changed while it was being removed")
  ) {
    return error.message;
  }
  return friendlyError(error);
}
