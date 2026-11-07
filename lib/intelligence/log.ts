/**
 * Error logging for AI paths. Never logs prompts, completions or record
 * contents — only error class, HTTP status and provider error code.
 */
export function describeAiError(err: unknown): { name: string; status?: number; code?: string } {
  const e = err as { name?: string; status?: number; code?: string; constructor?: { name?: string } };
  return {
    name: e?.constructor?.name ?? e?.name ?? "Error",
    status: typeof e?.status === "number" ? e.status : undefined,
    code: typeof e?.code === "string" ? e.code : undefined,
  };
}

export function logAiError(scope: string, err: unknown, meta?: Record<string, string | number | undefined>) {
  console.error(`[intelligence:${scope}]`, { ...describeAiError(err), ...meta });
}

/** Short, user-safe message stored on a failed insight. */
export function publicAiError(err: unknown): string {
  const { status, name } = describeAiError(err);
  if (name === "AiNotConfiguredError") return "AI is not configured.";
  if (status === 401 || status === 403) return "The AI provider rejected the API key.";
  if (status === 429) return "The AI provider is rate limiting requests. Try again shortly.";
  if (status && status >= 500) return "The AI provider is temporarily unavailable.";
  if (name.includes("Timeout")) return "The AI request timed out.";
  return "Insight generation failed.";
}
