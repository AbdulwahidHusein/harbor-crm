"use server";
import { z } from "zod";
import { requireAuthenticated, AuthenticationError, AuthorizationError } from "@/lib/authz";
import { getInsightView, requestInsight, type InsightView } from "@/lib/intelligence/insights";
import { logAiError } from "@/lib/intelligence/log";

const input = z.object({
  entityType: z.enum(["contact", "account", "opportunity"]),
  entityId: z.string().uuid(),
});

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/** Signals + cached AI insight for a record the caller can read. Partners are excluded. */
export async function getRecordIntelligence(args: z.input<typeof input>): Promise<Result<InsightView>> {
  const parsed = input.safeParse(args);
  if (!parsed.success) return { error: "INVALID_INPUT" };
  try {
    const user = await requireAuthenticated();
    const view = await getInsightView(user, parsed.data.entityType, parsed.data.entityId);
    return view ? { data: view } : { error: "NOT_FOUND" };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "UNAUTHORIZED" };
    if (e instanceof AuthorizationError) return { error: "FORBIDDEN" };
    logAiError("action.get", e);
    return { error: "FAILED" };
  }
}

export async function refreshRecordIntelligence(args: z.input<typeof input> & { force?: boolean }): Promise<Result<{ queued: boolean }>> {
  const parsed = input.safeParse(args);
  if (!parsed.success) return { error: "INVALID_INPUT" };
  try {
    const user = await requireAuthenticated();
    const res = await requestInsight(user, parsed.data.entityType, parsed.data.entityId, { force: Boolean(args.force) });
    return res.ok ? { data: { queued: res.queued } } : { error: res.error };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "UNAUTHORIZED" };
    if (e instanceof AuthorizationError) return { error: "FORBIDDEN" };
    logAiError("action.refresh", e);
    return { error: "FAILED" };
  }
}
