/**
 * NextCRM Intelligence — shared types.
 *
 * Two layers, deliberately separated in the UI:
 *  - Signals: deterministic facts computed from CRM records. Always available,
 *    no AI involved, every signal carries the records that prove it.
 *  - Insights: AI synthesis over a bounded, scoped context. Every claim must
 *    cite context handles; uncited or unknown citations are dropped server-side.
 */

export type EntityType = "contact" | "account" | "opportunity" | "lead";

export type EvidenceType =
  | "activity"
  | "task"
  | "opportunity"
  | "invoice"
  | "email"
  | "contact"
  | "account"
  | "lead"
  | "note"
  | "audit";

/** A pointer to a real CRM record that supports a statement. */
export interface EvidenceRef {
  type: EvidenceType;
  id: string;
  label: string;
  /** ISO date most relevant to the record (activity date, due date…). */
  date?: string | null;
  href?: string | null;
}

export interface SubjectRef {
  type: EntityType | "task";
  id: string;
  label: string;
  href: string;
}

export type SignalKind =
  | "no_recent_interaction"
  | "engagement_drop"
  | "overdue_task"
  | "missed_scheduled_activity"
  | "upcoming_activity"
  | "deal_no_activity"
  | "deal_stage_stalled"
  | "deal_close_date_passed"
  | "deal_no_contacts"
  | "deal_no_next_step"
  | "invoice_overdue"
  | "lead_no_followup";

export type Severity = "high" | "medium" | "low";

export interface Signal {
  /** Stable key, used for dismissals: `${kind}:${recordId}`. */
  key: string;
  kind: SignalKind;
  severity: Severity;
  title: string;
  detail: string;
  subject: SubjectRef;
  evidence: EvidenceRef[];
  /** Pre-filled task the user can create in one click. */
  suggestedTask?: { title: string; dueInDays: number } | null;
  /** Used for ranking: larger = more money at stake. */
  value?: number | null;
}

/** One record exposed to the model, addressed by a short handle (A1, T2…). */
export interface ContextItem {
  handle: string;
  ref: EvidenceRef;
  /** Compact, model-facing facts about the record. Never raw HTML. */
  facts: Record<string, string | number | boolean | null>;
}

export interface RecordContext {
  subject: SubjectRef;
  /** Facts about the subject itself (name, role, stage…). */
  profile: Record<string, string | number | boolean | null>;
  items: ContextItem[];
  signals: Signal[];
  /** Fingerprint of everything above; changes when underlying data changes. */
  sourceHash: string;
}

export const INSIGHT_KINDS = ["relationship", "deal"] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];
