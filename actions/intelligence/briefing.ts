"use server";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { buildBriefing, generateFocus, getCachedFocus } from "@/lib/intelligence/briefing";
import { logAiError } from "@/lib/intelligence/log";

/** Generate (or return the cached) AI focus line for today's briefing. */
export async function getBriefingFocus(opts: { generate?: boolean } = {}) {
  try {
    const user = await requireAuthenticated();
    const briefing = await buildBriefing(user);
    const cached = await getCachedFocus(user, briefing.signalHash);
    if (cached || !opts.generate) return { data: cached };
    return generateFocus(user, briefing);
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "UNAUTHORIZED" };
    logAiError("action.focus", e);
    return { error: "FAILED" };
  }
}
