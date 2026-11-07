/**
 * Structured-output schemas. Kept free of length/format constraints so they
 * are accepted by strict JSON-schema mode; bounds are enforced after parsing
 * in `ground()`. Every claim carries `sources`: context handles like "A3".
 */
import { z } from "zod";

const sources = z.array(z.string()).describe("Context handles (e.g. A1, T2) that directly support this item. Required.");

export const relationshipInsightSchema = z.object({
  summary: z.string().describe("2–4 sentence factual summary of the relationship. Plain text."),
  summarySources: sources,
  keyInteractions: z.array(z.object({ text: z.string(), sources })).describe("Up to 5 most important past interactions."),
  commitments: z
    .array(
      z.object({
        text: z.string().describe("What was promised or requested, and by whom."),
        owedBy: z.enum(["us", "them", "unclear"]),
        status: z.enum(["open", "fulfilled", "unclear"]),
        sources,
      }),
    )
    .describe("Only commitments explicitly stated in the records."),
  openQuestions: z.array(z.object({ text: z.string(), sources })).describe("Unanswered questions or unresolved matters stated in the records."),
  engagement: z.object({
    trend: z.enum(["increasing", "stable", "declining", "insufficient_data"]),
    explanation: z.string(),
    sources,
  }),
  nextActions: z
    .array(z.object({ action: z.string(), rationale: z.string(), priority: z.enum(["high", "medium", "low"]), sources }))
    .describe("Up to 3 concrete next actions, each justified by records."),
});

export const dealInsightSchema = z.object({
  progression: z.string().describe("2–4 sentences on how the deal has progressed, using recorded history only."),
  progressionSources: sources,
  risks: z
    .array(z.object({ risk: z.string(), severity: z.enum(["high", "medium", "low"]), sources }))
    .describe("Evidence-based risks. No probability estimates."),
  unresolvedRequirements: z.array(z.object({ text: z.string(), sources })),
  stakeholderGaps: z
    .array(z.object({ text: z.string(), sources }))
    .describe("Missing or unengaged decision-makers, judged only from linked contacts' roles and activity."),
  nextSteps: z.array(z.object({ action: z.string(), rationale: z.string(), sources })).describe("Up to 3 next steps."),
});

export const briefingFocusSchema = z.object({
  focus: z.string().describe("One or two sentences describing what matters most today, referencing the provided items only."),
  picks: z
    .array(z.object({ key: z.string().describe("The `key` of one provided item."), why: z.string().describe("One sentence.") }))
    .describe("The three most important items, most important first."),
});

export type RelationshipInsight = z.infer<typeof relationshipInsightSchema>;
export type DealInsight = z.infer<typeof dealInsightSchema>;
export type BriefingFocus = z.infer<typeof briefingFocusSchema>;
