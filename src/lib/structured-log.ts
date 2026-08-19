export type StructuredLogEvent = {
  operation: string;
  correlationId: string;
  stage: string;
  durationMs: number;
  outcome: string;
  guestId?: string;
  notebookId?: string;
  sourceId?: string;
  sourceKind?: string;
  answerKind?: string;
  provider?: string;
  model?: string;
  providerStatus?: number;
  providerCode?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  category?: string;
};

const SAFE_ERROR_CATEGORIES = new Set([
  "answer_provider_invalid_response",
  "answer_provider_not_configured",
  "answer_provider_request_failed",
  "deployment_question_budget_reached",
  "embedding_provider_dimension_mismatch",
  "embedding_provider_invalid_response",
  "embedding_provider_not_configured",
  "embedding_provider_pooling_mismatch",
  "embedding_provider_request_failed",
  "ingestion_limit_reached",
  "ingestion_lease_not_owned",
  "ingestion_lease_lost",
  "notebook_deletion_incomplete",
  "notebook_not_authorized",
  "notebook_sources_changed",
  "pdf_content_empty",
  "pdf_encrypted",
  "pdf_page_limit",
  "pdf_storage_missing",
  "pdf_type_unsupported",
  "pdf_unreadable",
  "processing_failed",
  "question_limit_reached",
  "source_changed_during_answer",
  "source_content_empty",
  "source_deleting",
  "source_deletion_incomplete",
  "source_not_authorized",
]);

export function writeStructuredLog(
  level: "info" | "error",
  event: StructuredLogEvent,
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  if (level === "error") console.error(entry);
  else console.info(entry);
}

export function safeErrorCategory(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown_failure";
  const category = message.split(":", 1)[0];
  return SAFE_ERROR_CATEGORIES.has(category) ? category : "unknown_failure";
}
