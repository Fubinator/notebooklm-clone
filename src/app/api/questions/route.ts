import { createAnswerModel } from "@/features/answering/answer-model";
import { AnswerProviderRequestError } from "@/features/answering/cloudflare-answer-model";
import { answerGroundedQuestion } from "@/features/answering/grounded-answering";
import { createAnsweringPersistence } from "@/features/answering/persistence";
import { retrieveEvidence } from "@/features/answering/retrieval";
import { validateQuestion } from "@/features/conversations/model";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/validation";
import {
  getApplicationLimits,
  getDeploymentQuestionCeiling,
} from "@/lib/limits";
import { safeErrorCategory, writeStructuredLog } from "@/lib/structured-log";

type QuestionRequest = {
  notebookId?: unknown;
  question?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  }

  let body: QuestionRequest;
  try {
    body = (await request.json()) as QuestionRequest;
  } catch {
    return Response.json(
      { error: "The Question request was invalid." },
      { status: 400 },
    );
  }

  const validation = validateQuestion(
    typeof body.question === "string" ? body.question : "",
  );
  if (!validation.ok || !isUuid(body.notebookId)) {
    return Response.json(
      {
        error: validation.ok ? "Choose a valid Notebook." : validation.message,
      },
      { status: 400 },
    );
  }

  const correlationId = crypto.randomUUID();
  const startedAt = performance.now();
  const answerModel = createAnswerModel();
  try {
    const admin = createAdminClient();
    const limits = getApplicationLimits();
    const deploymentHardCeiling = getDeploymentQuestionCeiling();

    const result = await answerGroundedQuestion(
      {
        notebookId: body.notebookId,
        question: validation.question,
        correlationId,
      },
      {
        persistence: createAnsweringPersistence(admin, user.id, {
          guestDailyLimit: limits.questionsPerGuestPerUtcDay,
          deploymentHardCeiling,
        }),
        retrieve: (notebookId, question) =>
          retrieveEvidence(admin, user.id, notebookId, question),
        answerModel,
      },
    );

    const tokenUsage = answerModel.tokenUsage?.();
    writeStructuredLog("info", {
      operation: "grounded_answering",
      correlationId,
      guestId: user.id,
      notebookId: body.notebookId,
      stage: "complete",
      durationMs: Math.round(performance.now() - startedAt),
      outcome: result.status,
      answerKind: result.kind,
      provider: answerModel.provider,
      model: answerModel.model,
      ...(tokenUsage ?? {}),
    });

    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const sourceChanged =
      message.includes("invalid_evidence") ||
      message.includes("citation_unavailable");
    const category = sourceChanged
      ? "source_changed_during_answer"
      : safeErrorCategory(error);
    writeStructuredLog("error", {
      operation: "grounded_answering",
      correlationId,
      guestId: user.id,
      notebookId: body.notebookId,
      stage: "request",
      durationMs: Math.round(performance.now() - startedAt),
      outcome: "failed",
      category,
      provider: answerModel.provider,
      model: answerModel.model,
      ...(error instanceof AnswerProviderRequestError
        ? {
            providerStatus: error.status,
            ...(error.providerCode === null
              ? {}
              : { providerCode: error.providerCode }),
          }
        : {}),
    });

    if (message.includes("question_limit_reached")) {
      return Response.json(
        {
          error: `You have reached today’s ${getApplicationLimits().questionsPerGuestPerUtcDay} grounded Questions. Your existing research remains available.`,
        },
        { status: 429 },
      );
    }

    if (message.includes("deployment_question_budget_reached")) {
      return Response.json(
        {
          error:
            "New Questions are temporarily unavailable because the deployment budget is paused. Existing research remains available.",
        },
        { status: 503 },
      );
    }

    if (message.includes("notebook_not_authorized")) {
      return Response.json(
        { error: "That Notebook is not available." },
        { status: 404 },
      );
    }

    if (sourceChanged) {
      return Response.json(
        {
          error:
            "A Source was removed while this Answer was being prepared. Ask the Question again.",
          category,
          correlationId,
        },
        { status: 409 },
      );
    }

    return Response.json(
      {
        error: "The Answer could not be completed safely. Please try again.",
        category,
        correlationId,
      },
      { status: 502 },
    );
  }
}
