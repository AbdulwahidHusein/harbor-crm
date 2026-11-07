/**
 * Insight lifecycle: read cached state, request (re)generation, generate.
 * Generation runs in an Inngest job when available and inline otherwise.
 * AI output is stored in its own table and never written to CRM records.
 */
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz";
import { inngest } from "@/inngest/client";
import { buildContext } from "./context";
import { GROUNDING_RULES, generateStructured, isAiConfigured, renderContext } from "./llm";
import { dealInsightSchema, relationshipInsightSchema, type DealInsight, type RelationshipInsight } from "./schemas";
import { groundList, groundText, resolvePayload } from "./ground";
import { logAiError, publicAiError } from "./log";
import type { EvidenceRef, InsightKind, RecordContext, Signal } from "./types";

export type InsightEntity = "contact" | "account" | "opportunity";
export const INSIGHT_EVENT = "intelligence/insight.requested";

/** A job that has not finished within this window is treated as lost. */
const STUCK_AFTER_MS = 3 * 60_000;
/** Minimum spacing between regenerations of the same insight. */
const MIN_REFRESH_MS = 20_000;

export function kindFor(entityType: InsightEntity): InsightKind {
  return entityType === "opportunity" ? "deal" : "relationship";
}

const key = (user: AuthzUser, entityType: InsightEntity, entityId: string) => ({
  kind_entityType_entityId_userId: { kind: kindFor(entityType), entityType, entityId, userId: user.id },
});

export interface InsightView {
  subject: RecordContext["subject"];
  signals: Signal[];
  aiConfigured: boolean;
  status: "NONE" | "PENDING" | "GENERATING" | "READY" | "FAILED";
  /** True when CRM data changed after the insight was generated. */
  stale: boolean;
  generatedAt: string | null;
  model: string | null;
  error: string | null;
  /** Payload with every `sources` resolved to EvidenceRef[]. */
  insight: unknown | null;
  evidenceCount: number;
}

/** Current signals plus the cached insight for the viewer. Throws AuthorizationError when not readable. */
export async function getInsightView(user: AuthzUser, entityType: InsightEntity, entityId: string): Promise<InsightView | null> {
  const ctx = await buildContext(user, entityType, entityId);
  if (!ctx) return null;
  const [row, aiConfigured] = await Promise.all([
    prismadb.crm_AI_Insights.findUnique({ where: key(user, entityType, entityId) }),
    isAiConfigured(user.id),
  ]);

  let status: InsightView["status"] = row?.status ?? "NONE";
  if ((status === "PENDING" || status === "GENERATING") && row && Date.now() - row.updatedAt.getTime() > STUCK_AFTER_MS) {
    status = "FAILED";
  }
  const sources = (row?.sources ?? {}) as unknown as Record<string, EvidenceRef>;
  return {
    subject: ctx.subject,
    signals: ctx.signals,
    aiConfigured,
    status,
    stale: Boolean(row?.generatedAt && row.sourceHash && row.sourceHash !== ctx.sourceHash),
    generatedAt: row?.generatedAt?.toISOString() ?? null,
    model: row?.model ?? null,
    error: status === "FAILED" ? row?.error ?? "Insight generation did not complete." : null,
    insight: row?.payload ? resolvePayload(row.payload, sources) : null,
    evidenceCount: ctx.items.length,
  };
}

/**
 * Queue (re)generation. Returns quickly when Inngest accepts the event;
 * otherwise generates inline so the feature works without a job runner.
 */
export async function requestInsight(user: AuthzUser, entityType: InsightEntity, entityId: string, opts: { force?: boolean } = {}) {
  // Authorization + existence check before anything is queued.
  const ctx = await buildContext(user, entityType, entityId);
  if (!ctx) return { ok: false as const, error: "NOT_FOUND" };
  if (!(await isAiConfigured(user.id))) return { ok: false as const, error: "AI_NOT_CONFIGURED" };

  const existing = await prismadb.crm_AI_Insights.findUnique({ where: key(user, entityType, entityId) });
  if (existing) {
    const busy = (existing.status === "PENDING" || existing.status === "GENERATING") && Date.now() - existing.updatedAt.getTime() < STUCK_AFTER_MS;
    if (busy) return { ok: true as const, queued: true };
    const fresh = existing.status === "READY" && existing.sourceHash === ctx.sourceHash;
    if (fresh && !opts.force) return { ok: true as const, queued: false };
    if (existing.generatedAt && Date.now() - existing.generatedAt.getTime() < MIN_REFRESH_MS) return { ok: true as const, queued: false };
  }

  await prismadb.crm_AI_Insights.upsert({
    where: key(user, entityType, entityId),
    create: { kind: kindFor(entityType), entityType, entityId, userId: user.id, status: "PENDING" },
    update: { status: "PENDING", error: null },
  });

  if (process.env.NEXTCRM_AI_INLINE !== "1") {
    try {
      await inngest.send({ name: INSIGHT_EVENT, data: { entityType, entityId, userId: user.id } });
      return { ok: true as const, queued: true };
    } catch (err) {
      logAiError("queue", err, { entityType });
    }
  }
  await generateInsight(user, entityType, entityId);
  return { ok: true as const, queued: false };
}

function groundRelationship(raw: RelationshipInsight, known: Set<string>) {
  const summary = groundText(raw.summary, raw.summarySources, known);
  const engagementSources = groundText(raw.engagement?.explanation, raw.engagement?.sources, known);
  return {
    summary: summary.text,
    summarySources: summary.sources,
    keyInteractions: groundList(raw.keyInteractions, known, 5),
    commitments: groundList(raw.commitments, known, 6),
    openQuestions: groundList(raw.openQuestions, known, 5),
    engagement: {
      trend: engagementSources.sources.length ? raw.engagement.trend : "insufficient_data",
      explanation: engagementSources.text,
      sources: engagementSources.sources,
    },
    nextActions: groundList(raw.nextActions, known, 3),
  };
}

function groundDeal(raw: DealInsight, known: Set<string>) {
  const progression = groundText(raw.progression, raw.progressionSources, known);
  return {
    progression: progression.text,
    progressionSources: progression.sources,
    risks: groundList(raw.risks, known, 5),
    unresolvedRequirements: groundList(raw.unresolvedRequirements, known, 5),
    stakeholderGaps: groundList(raw.stakeholderGaps, known, 4),
    nextSteps: groundList(raw.nextSteps, known, 3),
  };
}

/** Build context, call the model, ground citations, store. Never throws. */
export async function generateInsight(user: AuthzUser, entityType: InsightEntity, entityId: string): Promise<void> {
  const where = key(user, entityType, entityId);
  try {
    await prismadb.crm_AI_Insights.upsert({
      where,
      create: { kind: kindFor(entityType), entityType, entityId, userId: user.id, status: "GENERATING" },
      update: { status: "GENERATING" },
    });
    const ctx = await buildContext(user, entityType, entityId);
    if (!ctx) throw new Error("NOT_FOUND");
    const known = new Set(ctx.items.map((i) => i.handle));
    const sourceMap = Object.fromEntries(ctx.items.map((i) => [i.handle, i.ref]));
    const prompt = renderContext(ctx, new Date());

    let payload: unknown;
    let model: string;
    if (entityType === "opportunity") {
      const res = await generateStructured({
        userId: user.id,
        schema: dealInsightSchema,
        schemaName: "deal_insight",
        system: `You are Harbor CRM's deal analyst. Assess one sales opportunity from its CRM records for the account owner.\n${GROUNDING_RULES}`,
        prompt,
      });
      payload = groundDeal(res.data, known);
      model = res.model;
    } else {
      const res = await generateStructured({
        userId: user.id,
        schema: relationshipInsightSchema,
        schemaName: "relationship_insight",
        system: `You are Harbor CRM's relationship analyst. Summarize the business relationship with one ${entityType === "account" ? "company" : "person"} from its CRM records so the user knows where things stand and what to do next.\n${GROUNDING_RULES}`,
        prompt,
      });
      payload = groundRelationship(res.data, known);
      model = res.model;
    }

    await prismadb.crm_AI_Insights.update({
      where,
      data: {
        status: "READY",
        payload: payload as object,
        sources: sourceMap as object,
        sourceHash: ctx.sourceHash,
        model,
        error: null,
        generatedAt: new Date(),
      },
    });
  } catch (err) {
    logAiError("generate", err, { entityType });
    await prismadb.crm_AI_Insights
      .update({ where, data: { status: "FAILED", error: publicAiError(err) } })
      .catch((e) => logAiError("generate.persist", e));
  }
}
