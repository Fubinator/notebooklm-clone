import { createChatModel } from "@/features/answering/chat";
import { answerGroundedQuestion } from "@/features/answering/grounded-answering";
import { createAnsweringPersistence } from "@/features/answering/persistence";
import { retrieveEvidence } from "@/features/answering/retrieval";
import { validateQuestion } from "@/features/conversations/model";
import { createClient } from "@/lib/supabase/server";

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
  try {
    const result = await answerGroundedQuestion(
      {
        notebookId: body.notebookId,
        question: validation.question,
        correlationId,
      },
      {
        persistence: createAnsweringPersistence(supabase),
        retrieve: (notebookId, question) =>
          retrieveEvidence(supabase, notebookId, question),
        chatModel: createChatModel(),
      },
    );

    return Response.json({ result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error(
      JSON.stringify({
        operation: "grounded_answering",
        correlationId,
        guestId: user.id,
        notebookId: body.notebookId,
        outcome: "failed",
        category: safeErrorCategory(message),
      }),
    );

    if (message.includes("question_limit_reached")) {
      return Response.json(
        { error: "You have reached today’s 20 grounded Questions." },
        { status: 429 },
      );
    }

    if (message.includes("notebook_not_authorized")) {
      return Response.json(
        { error: "That Notebook is not available." },
        { status: 404 },
      );
    }

    return Response.json(
      { error: "The Answer could not be completed safely. Please try again." },
      { status: 502 },
    );
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function safeErrorCategory(message: string) {
  return message.split(":", 1)[0] || "unknown_failure";
}
