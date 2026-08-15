"use client";

import { FileText, MessageSquareText } from "lucide-react";
import { ConversationView } from "@/components/conversation-view";
import { SourcePreview } from "@/components/source-preview";
import { Button } from "@/components/ui/button";
import type {
  Citation,
  ConversationMessage,
} from "@/features/conversations/model";
import type { ConversationLoadState } from "@/features/conversations/use-conversation";
import type { Notebook } from "@/features/notebooks/model";
import type { ReadableSource } from "@/features/sources/model";
import { cn } from "@/lib/utils";
import { DEFAULT_APPLICATION_LIMITS } from "@/lib/limits";

export function ConversationPane({
  visible,
  notebook,
  source,
  messages,
  status,
  pendingQuestion,
  error,
  canAsk,
  onCloseSource,
  onCreate,
  onAsk,
  onRetry,
  onCitation,
  savedAnswerIds,
  savingAnswerId,
  onSaveAnswer,
  dailyQuestionLimit = DEFAULT_APPLICATION_LIMITS.questionsPerGuestPerUtcDay,
}: {
  visible: boolean;
  notebook?: Notebook;
  source?: ReadableSource;
  messages: ConversationMessage[];
  status: ConversationLoadState;
  pendingQuestion?: string;
  error?: string;
  canAsk: boolean;
  onCloseSource: () => void;
  onCreate: () => void;
  onAsk: (question: string) => Promise<boolean>;
  onRetry: () => void;
  onCitation: (citation: Citation) => void;
  savedAnswerIds: Set<string>;
  savingAnswerId?: string;
  onSaveAnswer: (answer: ConversationMessage) => void;
  dailyQuestionLimit?: number;
}) {
  return (
    <section
      className={cn(
        "min-h-0 flex-col bg-[var(--paper)] lg:flex",
        visible ? "flex" : "hidden",
      )}
      aria-label="Conversation"
      id="conversation-panel"
    >
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[var(--line)] px-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-[var(--muted)]" />
          <h2 className="text-sm font-semibold">Conversation</h2>
        </div>
        <span className="rounded-full bg-[var(--sage)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
          {dailyQuestionLimit}/day · Grounded
        </span>
      </div>
      {source ? (
        <SourcePreview source={source} onClose={onCloseSource} />
      ) : notebook ? (
        <ConversationView
          key={notebook.id}
          notebook={notebook}
          messages={messages}
          status={status}
          pendingQuestion={pendingQuestion}
          error={error}
          canAsk={canAsk}
          onAsk={onAsk}
          onRetry={onRetry}
          onCitation={onCitation}
          savedAnswerIds={savedAnswerIds}
          savingAnswerId={savingAnswerId}
          onSaveAnswer={onSaveAnswer}
          dailyQuestionLimit={dailyQuestionLimit}
        />
      ) : (
        <NoNotebook onCreate={onCreate} />
      )}
    </section>
  );
}

function NoNotebook({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[var(--sage)]">
          <FileText className="size-6" />
        </span>
        <h1 className="mt-6 font-serif text-4xl font-semibold tracking-[-0.04em]">
          A clear place to think.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Create a private Notebook for a Question, topic, or body of research.
        </p>
        <Button className="mt-6" onClick={onCreate}>
          Create your first Notebook
        </Button>
      </div>
    </div>
  );
}
