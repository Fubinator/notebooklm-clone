type LogValue = string | number | boolean | null | undefined;

export function writeStructuredLog(
  level: "info" | "error",
  event: Record<string, LogValue>,
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
  return message.split(":", 1)[0] || "unknown_failure";
}
