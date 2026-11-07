/**
 * Deterministic signal rules. Pure functions — no I/O, no AI — so they are
 * cheap, testable and keep working when the model provider is unavailable.
 * Every signal references the records that prove it.
 */
import type { EvidenceRef, Signal, SubjectRef, Severity } from "./types";

export const DAY_MS = 86_400_000;

export const THRESHOLDS = {
  /** Days without a completed interaction before a relationship needs attention. */
  relationshipQuietDays: 21,
  relationshipColdDays: 45,
  /** Days without activity on an open deal. */
  dealQuietDays: 14,
  dealColdDays: 30,
  /** Days in the same stage before a deal is considered stalled. */
  dealStageStallDays: 30,
  /** A scheduled activity this many days in the past, still "scheduled". */
  missedActivityGraceDays: 1,
  /** Lead without any follow-up after this many days. */
  leadFollowUpDays: 3,
  upcomingWindowDays: 7,
} as const;

export interface ActivityLite {
  id: string;
  type: string;
  title: string;
  date: Date;
  status: "scheduled" | "completed" | "cancelled";
}

export interface TaskLite {
  id: string;
  title: string;
  dueDateAt: Date | null;
  taskStatus: string | null;
}

export interface OpportunityLite {
  id: string;
  name: string;
  status: string | null;
  value: number;
  currency: string | null;
  closeDate: Date | null;
  stageName: string | null;
  stageEnteredAt: Date | null;
  nextStep: string | null;
  contactCount: number;
  createdAt: Date;
}

export interface InvoiceLite {
  id: string;
  number: string | null;
  dueDate: Date | null;
  balanceDue: number;
  currency: string;
  status: string;
  accountId: string;
  accountName: string;
}

export interface LeadLite {
  id: string;
  name: string;
  company: string | null;
  createdAt: Date | null;
  statusName: string | null;
}

export const hrefFor = {
  contact: (id: string) => `/crm/contacts/${id}`,
  account: (id: string) => `/crm/accounts/${id}`,
  opportunity: (id: string) => `/crm/opportunities/${id}`,
  lead: (id: string) => `/crm/leads/${id}`,
  invoice: (id: string) => `/invoices/${id}`,
  task: (id: string) => `/crm/tasks/viewtask/${id}`,
};

export function daysSince(date: Date | null | undefined, now: Date): number | null {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function activityRef(a: ActivityLite): EvidenceRef {
  return { type: "activity", id: a.id, label: `${capitalize(a.type)}: ${a.title}`, date: a.date.toISOString() };
}

export function taskRef(t: TaskLite): EvidenceRef {
  return {
    type: "task",
    id: t.id,
    label: `Task: ${t.title}`,
    date: t.dueDateAt?.toISOString() ?? null,
    href: hrefFor.task(t.id),
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isOpenTask = (t: TaskLite) => t.taskStatus !== "COMPLETE";

/** Latest completed interaction, or null. Cancelled and future-scheduled items don't count. */
export function lastInteraction(activities: ActivityLite[], now: Date): ActivityLite | null {
  let best: ActivityLite | null = null;
  for (const a of activities) {
    if (a.status !== "completed" || a.date > now) continue;
    if (!best || a.date > best.date) best = a;
  }
  return best;
}

function overdueTaskSignals(subject: SubjectRef, tasks: TaskLite[], now: Date): Signal[] {
  return tasks
    .filter((t) => isOpenTask(t) && t.dueDateAt && t.dueDateAt.getTime() < now.getTime() - DAY_MS / 2)
    .map((t) => {
      const late = daysSince(t.dueDateAt, now) ?? 0;
      return {
        key: `overdue_task:${t.id}`,
        kind: "overdue_task" as const,
        severity: (late > 7 ? "high" : "medium") as Severity,
        title: `Overdue task: ${t.title}`,
        detail: `Due ${plural(late, "day")} ago and still open.`,
        subject,
        evidence: [taskRef(t)],
        suggestedTask: null,
      };
    });
}

function missedActivitySignals(subject: SubjectRef, activities: ActivityLite[], now: Date): Signal[] {
  const cutoff = now.getTime() - THRESHOLDS.missedActivityGraceDays * DAY_MS;
  return activities
    .filter((a) => a.status === "scheduled" && a.date.getTime() < cutoff)
    .map((a) => ({
      key: `missed_scheduled_activity:${a.id}`,
      kind: "missed_scheduled_activity" as const,
      severity: "medium" as Severity,
      title: `${capitalize(a.type)} "${a.title}" has no recorded outcome`,
      detail: `It was scheduled ${plural(daysSince(a.date, now) ?? 0, "day")} ago but is still marked as scheduled.`,
      subject,
      evidence: [activityRef(a)],
      suggestedTask: { title: `Record outcome of ${a.type}: ${a.title}`, dueInDays: 0 },
    }));
}

/** Signals about a person or company relationship. */
export function relationshipSignals(input: {
  subject: SubjectRef;
  activities: ActivityLite[];
  tasks: TaskLite[];
  hasOpenDeals: boolean;
  now: Date;
}): Signal[] {
  const { subject, activities, tasks, hasOpenDeals, now } = input;
  const out: Signal[] = [];

  const last = lastInteraction(activities, now);
  const quiet = daysSince(last?.date, now);
  // Only flag silence where there is a relationship to lose: past interactions or live deals.
  if (last && quiet !== null && quiet >= THRESHOLDS.relationshipQuietDays && (hasOpenDeals || quiet < 365)) {
    out.push({
      key: `no_recent_interaction:${subject.id}`,
      kind: "no_recent_interaction",
      severity: quiet >= THRESHOLDS.relationshipColdDays && hasOpenDeals ? "high" : "medium",
      title: `No interaction with ${subject.label} in ${plural(quiet, "day")}`,
      detail: `Last recorded interaction was the ${last.type} "${last.title}".${hasOpenDeals ? " There are open opportunities." : ""}`,
      subject,
      evidence: [activityRef(last)],
      suggestedTask: { title: `Follow up with ${subject.label}`, dueInDays: 1 },
    });
  } else if (!last && hasOpenDeals) {
    out.push({
      key: `no_recent_interaction:${subject.id}`,
      kind: "no_recent_interaction",
      severity: "medium",
      title: `No recorded interactions with ${subject.label}`,
      detail: "There are open opportunities but no completed calls, meetings, emails or notes are logged.",
      subject,
      evidence: [],
      suggestedTask: { title: `Log or schedule first touchpoint with ${subject.label}`, dueInDays: 1 },
    });
  }

  // Engagement trend: last 30 days vs the 60 days before that (per-30-day rate).
  const completed = activities.filter((a) => a.status === "completed" && a.date <= now);
  const recent = completed.filter((a) => daysSince(a.date, now)! < 30);
  const prior = completed.filter((a) => {
    const d = daysSince(a.date, now)!;
    return d >= 30 && d < 90;
  });
  const priorRate = prior.length / 2;
  if (priorRate >= 2 && recent.length <= priorRate / 2) {
    out.push({
      key: `engagement_drop:${subject.id}`,
      kind: "engagement_drop",
      severity: "medium",
      title: `Engagement with ${subject.label} has dropped`,
      detail: `${plural(recent.length, "interaction")} in the last 30 days, down from about ${Math.round(priorRate)} per month before.`,
      subject,
      evidence: [...recent, ...prior].slice(0, 6).map(activityRef),
      suggestedTask: { title: `Check in with ${subject.label}`, dueInDays: 2 },
    });
  }

  out.push(...missedActivitySignals(subject, activities, now));
  out.push(...overdueTaskSignals(subject, tasks, now));

  const upcoming = activities
    .filter((a) => a.status === "scheduled" && a.date >= now && (a.date.getTime() - now.getTime()) / DAY_MS <= THRESHOLDS.upcomingWindowDays)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (upcoming.length) {
    const a = upcoming[0];
    out.push({
      key: `upcoming_activity:${a.id}`,
      kind: "upcoming_activity",
      severity: "low",
      title: `Upcoming ${a.type}: ${a.title}`,
      detail: `Scheduled for ${a.date.toISOString().slice(0, 10)}.`,
      subject,
      evidence: [activityRef(a)],
      suggestedTask: null,
    });
  }
  return out;
}

const OPEN_DEAL_STATUSES = new Set(["ACTIVE", "PENDING", null]);
export const isOpenDeal = (o: { status: string | null }) => OPEN_DEAL_STATUSES.has(o.status as never);

/** Signals about an open opportunity. Closed/inactive deals produce none. */
export function dealSignals(input: {
  opportunity: OpportunityLite;
  activities: ActivityLite[];
  tasks: TaskLite[];
  now: Date;
}): Signal[] {
  const { opportunity: o, activities, tasks, now } = input;
  if (!isOpenDeal(o)) return [];
  const subject: SubjectRef = { type: "opportunity", id: o.id, label: o.name, href: hrefFor.opportunity(o.id) };
  const oppEvidence: EvidenceRef = { type: "opportunity", id: o.id, label: o.name, href: subject.href };
  const out: Signal[] = [];

  const last = lastInteraction(activities, now);
  const quiet = daysSince(last?.date ?? o.createdAt, now) ?? 0;
  if (quiet >= THRESHOLDS.dealQuietDays) {
    out.push({
      key: `deal_no_activity:${o.id}`,
      kind: "deal_no_activity",
      severity: quiet >= THRESHOLDS.dealColdDays ? "high" : "medium",
      title: `No activity on "${o.name}" for ${plural(quiet, "day")}`,
      detail: last
        ? `Last activity: ${last.type} "${last.title}".`
        : "No activities have been logged on this opportunity since it was created.",
      subject,
      evidence: last ? [activityRef(last), oppEvidence] : [oppEvidence],
      suggestedTask: { title: `Re-engage on ${o.name}`, dueInDays: 1 },
      value: o.value,
    });
  }

  const inStage = daysSince(o.stageEnteredAt, now);
  if (inStage !== null && inStage >= THRESHOLDS.dealStageStallDays) {
    out.push({
      key: `deal_stage_stalled:${o.id}`,
      kind: "deal_stage_stalled",
      severity: inStage >= THRESHOLDS.dealStageStallDays * 2 ? "high" : "medium",
      title: `"${o.name}" has been in ${o.stageName ?? "its stage"} for ${plural(inStage, "day")}`,
      detail: "The stage has not changed for longer than the stall threshold.",
      subject,
      evidence: [oppEvidence],
      suggestedTask: { title: `Agree next step to advance ${o.name}`, dueInDays: 2 },
      value: o.value,
    });
  }

  if (o.closeDate && o.closeDate.getTime() < now.getTime() - DAY_MS) {
    out.push({
      key: `deal_close_date_passed:${o.id}`,
      kind: "deal_close_date_passed",
      severity: "high",
      title: `Expected close date for "${o.name}" has passed`,
      detail: `Close date was ${o.closeDate.toISOString().slice(0, 10)} and the deal is still open.`,
      subject,
      evidence: [oppEvidence],
      suggestedTask: { title: `Update close date or status for ${o.name}`, dueInDays: 0 },
      value: o.value,
    });
  }

  if (o.contactCount === 0) {
    out.push({
      key: `deal_no_contacts:${o.id}`,
      kind: "deal_no_contacts",
      severity: "medium",
      title: `No contacts linked to "${o.name}"`,
      detail: "No people are associated with this deal, so decision-makers are unknown.",
      subject,
      evidence: [oppEvidence],
      suggestedTask: { title: `Identify decision-makers for ${o.name}`, dueInDays: 3 },
      value: o.value,
    });
  }

  const openTasks = tasks.filter(isOpenTask);
  const upcoming = activities.some((a) => a.status === "scheduled" && a.date >= now);
  if (!o.nextStep?.trim() && openTasks.length === 0 && !upcoming) {
    out.push({
      key: `deal_no_next_step:${o.id}`,
      kind: "deal_no_next_step",
      severity: "low",
      title: `No next step planned for "${o.name}"`,
      detail: "There is no next step, open task or scheduled activity on this deal.",
      subject,
      evidence: [oppEvidence],
      suggestedTask: { title: `Plan next step for ${o.name}`, dueInDays: 2 },
      value: o.value,
    });
  }

  out.push(...missedActivitySignals(subject, activities, now));
  out.push(...overdueTaskSignals(subject, tasks, now));
  return out;
}

export function invoiceSignals(invoices: InvoiceLite[], now: Date): Signal[] {
  const unpaid = new Set(["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"]);
  return invoices
    .filter((i) => unpaid.has(i.status) && i.balanceDue > 0 && i.dueDate && i.dueDate.getTime() < now.getTime() - DAY_MS / 2)
    .map((i) => {
      const late = daysSince(i.dueDate, now) ?? 0;
      const label = i.number ? `Invoice ${i.number}` : "Draft-numbered invoice";
      return {
        key: `invoice_overdue:${i.id}`,
        kind: "invoice_overdue" as const,
        severity: (late > 30 ? "high" : "medium") as Severity,
        title: `${label} for ${i.accountName} is ${plural(late, "day")} overdue`,
        detail: `${i.balanceDue.toFixed(2)} ${i.currency} outstanding.`,
        subject: { type: "account" as const, id: i.accountId, label: i.accountName, href: hrefFor.account(i.accountId) },
        evidence: [{ type: "invoice" as const, id: i.id, label, date: i.dueDate?.toISOString() ?? null, href: hrefFor.invoice(i.id) }],
        suggestedTask: { title: `Chase payment: ${label} (${i.accountName})`, dueInDays: 0 },
        value: i.balanceDue,
      };
    });
}

export function leadSignals(lead: LeadLite, activities: ActivityLite[], now: Date): Signal[] {
  const age = daysSince(lead.createdAt, now);
  if (age === null || age < THRESHOLDS.leadFollowUpDays) return [];
  const status = (lead.statusName ?? "").toLowerCase();
  if (/(lost|disqualif|convert|closed|won)/.test(status)) return [];
  const last = lastInteraction(activities, now);
  if (last && (daysSince(last.date, now) ?? 0) < 7) return [];
  const label = lead.company ? `${lead.name} (${lead.company})` : lead.name;
  return [
    {
      key: `lead_no_followup:${lead.id}`,
      kind: "lead_no_followup",
      severity: age > 14 && !last ? "high" : "medium",
      title: last ? `Lead ${label} has gone quiet` : `Lead ${label} has not been contacted`,
      detail: last
        ? `Last interaction ${plural(daysSince(last.date, now) ?? 0, "day")} ago.`
        : `Created ${plural(age, "day")} ago with no recorded follow-up.`,
      subject: { type: "lead", id: lead.id, label, href: hrefFor.lead(lead.id) },
      evidence: last ? [activityRef(last)] : [{ type: "lead", id: lead.id, label, href: hrefFor.lead(lead.id) }],
      suggestedTask: { title: `Follow up with lead ${label}`, dueInDays: 0 },
    },
  ];
}

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

/** Most important first: severity, then money at stake, then kind priority. */
export function rankSignals(signals: Signal[]): Signal[] {
  const kindWeight: Partial<Record<Signal["kind"], number>> = {
    deal_close_date_passed: 5,
    invoice_overdue: 4,
    overdue_task: 4,
    no_recent_interaction: 3,
    deal_no_activity: 3,
    missed_scheduled_activity: 3,
    lead_no_followup: 2,
  };
  return [...signals].sort(
    (a, b) =>
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
      (b.value ?? 0) - (a.value ?? 0) ||
      (kindWeight[b.kind] ?? 1) - (kindWeight[a.kind] ?? 1),
  );
}

/** Drop duplicates by key, keeping the first occurrence. */
export function dedupeSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  return signals.filter((s) => (seen.has(s.key) ? false : (seen.add(s.key), true)));
}
