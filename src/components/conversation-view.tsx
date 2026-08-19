"use client";

import {
  ArrowUp,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type Citation,
  type ConversationMessage,
} from "@/features/conversations/model";
import type { ConversationLoadState } from "@/features/conversations/use-conversation";
import type { Notebook } from "@/features/notebooks/model";
import { cn } from "@/lib/utils";

export function ConversationView({
  notebook,
  messages,
  status,
  pendingQuestion,
  error,
  canAsk,
  onAsk,
  onRetry,
  onCitation,
  savedAnswerIds,
  savingAnswerId,
  onSaveAnswer,
  dailyQuestionLimit,
}: {
  notebook: Notebook;
  messages: ConversationMessage[];
  status: ConversationLoadState;
  pendingQuestion?: string;
  error?: string;
  canAsk: boolean;
  onAsk: (question: string) => Promise<boolean>;
  onRetry: () => void;
  onCitation: (citation: Citation) => void;
  savedAnswerIds: Set<string>;
  savingAnswerId?: string;
  onSaveAnswer: (answer: ConversationMessage) => void;
  dailyQuestionLimit: number;
}) {
  const [question, setQuestion] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pendingQuestion]);

  useEffect(() => {
    if (error && canAsk && !pendingQuestion) questionRef.current?.focus();
  }, [canAsk, error, pendingQuestion]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAsk(question)) setQuestion("");
  }

  const hasConversation = messages.length > 0 || pendingQuestion;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
        {status === "loading" ? (
          <ConversationStatus
            icon={<LoaderCircle className="size-5 animate-spin" />}
            title="Loading Conversation…"
            message="Restoring your private Questions, Answers, and Citations."
          />
        ) : status === "error" ? (
          <ConversationStatus
            title="Conversation couldn’t load"
            message="Your Sources are still available. Try restoring the Conversation again."
            action={
              <Button size="sm" variant="secondary" onClick={onRetry}>
                <RefreshCw className="size-3.5" /> Try again
              </Button>
            }
          />
        ) : hasConversation ? (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onCitation={onCitation}
                saved={savedAnswerIds.has(message.id)}
                saving={savingAnswerId === message.id}
                onSave={() => {
                  onSaveAnswer(message);
                }}
              />
            ))}
            {pendingQuestion ? (
              <>
                <QuestionBubble content={pendingQuestion} />
                <div
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"
                  role="status"
                >
                  <LoaderCircle className="size-4 animate-spin text-[var(--accent-strong)]" />
                  Retrieving evidence and validating Citations…
                </div>
              </>
            ) : null}
            <div ref={endRef} />
          </div>
        ) : (
          <ConversationWelcome
            notebook={notebook}
            canAsk={canAsk}
            onSuggestion={(suggestion) => void onAsk(suggestion)}
          />
        )}
      </div>

      <form
        className="shrink-0 border-t border-[var(--line)] p-4 sm:p-5"
        onSubmit={(event) => void submit(event)}
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--line-strong)] bg-white p-2 shadow-[0_8px_28px_rgba(24,38,31,.06)] focus-within:ring-2 focus-within:ring-[var(--ink)] focus-within:ring-offset-2">
          <div className="flex items-center gap-2">
            <Search className="ml-2 size-4 shrink-0 text-[var(--muted-light)]" />
            <input
              ref={questionRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={!canAsk || Boolean(pendingQuestion)}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-light)]"
              placeholder={
                canAsk
                  ? "Ask only what your Sources can support"
                  : "Add a ready Source before asking a Question"
              }
              aria-label="Ask a Question"
            />
            <button
              disabled={!canAsk || Boolean(pendingQuestion) || !question.trim()}
              className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 disabled:bg-[var(--line)] disabled:text-[var(--muted)]"
              aria-label="Submit Question"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--muted-light)]">
          Answers use only retrieved Passages from ready Sources ·{" "}
          {dailyQuestionLimit} grounded Questions per day
        </p>
        {error ? (
          <p
            className="mt-2 text-center text-xs font-semibold text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function MessageCard({
  message,
  onCitation,
  saved,
  saving,
  onSave,
}: {
  message: ConversationMessage;
  onCitation: (citation: Citation) => void;
  saved: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  if (message.role === "question") {
    return <QuestionBubble content={message.content} />;
  }

  const interrupted = message.status === "pending";
  return (
    <article
      className={cn(
        "max-w-2xl rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(24,38,31,.03)]",
        message.status === "failed" ? "border-red-200" : "border-[var(--line)]",
      )}
      aria-label={
        message.status === "completed" ? "Answer" : "Incomplete Answer"
      }
    >
      <p className="eyebrow">
        {message.answer_kind === "insufficient_evidence"
          ? "Insufficient evidence"
          : message.status === "failed"
            ? "Citation validation failed"
            : interrupted
              ? "Interrupted"
              : "Grounded Answer"}
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
        {interrupted
          ? "This Answer was interrupted before its Citations were validated. Ask the Question again to retry safely."
          : message.content}
      </p>
      {message.status === "completed" && message.citations.length > 0 ? (
        <div
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Validated Citations"
        >
          {message.citations.map((citation) => (
            <button
              key={citation.id}
              className="rounded-full border border-[var(--line-strong)] bg-[var(--sage)] px-3 py-1.5 text-[11px] font-bold text-[var(--ink-soft)] transition-colors outline-none hover:border-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"
              onClick={() => onCitation(citation)}
            >
              Citation {citation.display_order}
            </button>
          ))}
        </div>
      ) : null}
      {message.status === "completed" ? (
        <button
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--sage)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:outline-none disabled:opacity-60"
          disabled={saved || saving}
          onClick={onSave}
          aria-label={saved ? "Answer saved as Note" : "Save Answer as Note"}
        >
          {saving ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          {saved ? "Saved to Notes" : saving ? "Saving…" : "Save as Note"}
        </button>
      ) : null}
    </article>
  );
}

function QuestionBubble({ content }: { content: string }) {
  return (
    <div className="ml-auto max-w-xl rounded-2xl rounded-br-md bg-[var(--ink)] px-4 py-3 text-sm leading-6 text-white">
      <p className="sr-only">Question</p>
      {content}
    </div>
  );
}

function ConversationWelcome({
  notebook,
  canAsk,
  onSuggestion,
}: {
  notebook: Notebook;
  canAsk: boolean;
  onSuggestion: (suggestion: string) => void;
}) {
  const suggestions = notebook.is_example
    ? [
        "What are the four AI RMF functions?",
        "How should teams address confabulation?",
        "What makes an AI system trustworthy?",
      ]
    : [
        "What themes connect my Sources?",
        "Summarize the strongest evidence",
        "What should I investigate next?",
      ];

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-xl text-center">
        <div className="relative mx-auto w-fit">
          <span className="grid size-16 place-items-center rounded-[22px] bg-[var(--sage)] text-[var(--ink)]">
            <Lightbulb className="size-6" strokeWidth={1.7} />
          </span>
          <span className="absolute -right-1 -bottom-1 size-4 rounded-full border-2 border-[var(--paper)] bg-[var(--accent)]" />
        </div>
        <p className="eyebrow mt-6">
          {notebook.is_example ? "Example Notebook" : "Ready for Sources"}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {notebook.is_example
            ? "Ask, then inspect the evidence."
            : "Begin with what you know."}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
          {notebook.is_example
            ? "Your private Conversation is grounded only in the shared, read-only NIST Sources. Every completed Answer includes inspectable Citations."
            : `Questions in ${notebook.title} become available when it has a ready Source.`}
        </p>
        <div className="mt-7 grid gap-2 sm:grid-cols-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              disabled={!canAsk}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-left text-xs leading-5 font-medium text-[var(--muted)] transition-colors outline-none hover:border-[var(--accent-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 disabled:opacity-50"
              onClick={() => onSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversationStatus({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="grid h-full min-h-48 place-items-center text-center"
      role="status"
    >
      <div>
        {icon ? (
          <span className="mx-auto block w-fit text-[var(--accent-strong)]">
            {icon}
          </span>
        ) : null}
        <p className="mt-3 text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted)]">
          {message}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
