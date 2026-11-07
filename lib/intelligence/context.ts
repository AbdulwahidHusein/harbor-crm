/**
 * Scoped context builders. Each builder:
 *  1. asserts the viewer may read the subject (existing authz helpers),
 *  2. pulls only a bounded, relevant slice of linked records — always through
 *     the viewer's read scope (emails: only the viewer's own mailbox),
 *  3. assigns each record a short handle (A1, T1…) the model must cite,
 *  4. computes deterministic signals and a source fingerprint.
 * Nothing here calls a model.
 */
import { createHash } from "crypto";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz";
import {
  assertCanReadAccount,
  assertCanReadContact,
  assertCanReadOpportunity,
  contactReadScopeWhere,
  crmTaskReadScopeWhere,
  opportunityReadScopeWhere,
} from "@/lib/authz/scopes/crm";
import { invoiceReadScopeWhere } from "@/lib/invoices/permissions";
import type { ContextItem, EvidenceRef, RecordContext, Signal, SubjectRef } from "./types";
import {
  type ActivityLite,
  type OpportunityLite,
  type TaskLite,
  dealSignals,
  dedupeSignals,
  hrefFor,
  invoiceSignals,
  isOpenDeal,
  rankSignals,
  relationshipSignals,
} from "./signals";

const LIMITS = { activities: 30, tasks: 20, emails: 8, opportunities: 15, contacts: 20, invoices: 15 };
const TEXT_MAX = 600;

export function clip(text: string | null | undefined, max = TEXT_MAX): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const num = (d: unknown) => (d == null ? 0 : Number(d));
const personName = (c: { first_name?: string | null; last_name: string }) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ");

/** Fingerprint of the source data only (no relative times), so it is stable day to day. */
export function fingerprint(profile: unknown, items: ContextItem[]): string {
  const h = createHash("sha256");
  h.update(JSON.stringify(profile));
  for (const i of [...items].sort((a, b) => (a.ref.type + a.ref.id).localeCompare(b.ref.type + b.ref.id))) {
    h.update(JSON.stringify([i.ref.type, i.ref.id, i.facts]));
  }
  return h.digest("hex").slice(0, 32);
}

class Handles {
  private counters: Record<string, number> = {};
  next(prefix: string) {
    this.counters[prefix] = (this.counters[prefix] ?? 0) + 1;
    return `${prefix}${this.counters[prefix]}`;
  }
}

// ---------------------------------------------------------------------------
// Shared loaders
// ---------------------------------------------------------------------------

type LinkTarget = { entityType: "contact" | "account" | "opportunity"; ids: string[] };

/** Latest activities linked to any of the given records (soft-deleted excluded). */
async function loadActivities(targets: LinkTarget[], take = LIMITS.activities) {
  const OR = targets.filter((t) => t.ids.length).map((t) => ({ entityType: t.entityType, entityId: { in: t.ids } }));
  if (!OR.length) return [];
  const links = await prismadb.crm_ActivityLinks.findMany({ where: { OR }, select: { activityId: true }, take: 500 });
  const ids = Array.from(new Set(links.map((l) => l.activityId)));
  if (!ids.length) return [];
  return prismadb.crm_Activities.findMany({
    where: { id: { in: ids }, deletedAt: null },
    orderBy: { date: "desc" },
    take,
    select: {
      id: true, type: true, title: true, description: true, date: true, status: true, outcome: true,
      created_by_user: { select: { name: true } },
    },
  });
}

async function loadTasks(user: AuthzUser, where: Record<string, unknown>) {
  return prismadb.crm_Accounts_Tasks.findMany({
    where: { AND: [where, crmTaskReadScopeWhere(user)] },
    orderBy: [{ taskStatus: "asc" }, { dueDateAt: "desc" }],
    take: LIMITS.tasks,
    select: { id: true, title: true, content: true, dueDateAt: true, taskStatus: true, priority: true, createdAt: true },
  });
}

async function loadOwnEmails(user: AuthzUser, link: { contactIds?: string[]; accountId?: string }) {
  const or: Record<string, unknown>[] = [];
  if (link.contactIds?.length) or.push({ contacts: { some: { contactId: { in: link.contactIds } } } });
  if (link.accountId) or.push({ accounts: { some: { accountId: link.accountId } } });
  if (!or.length) return [];
  return prismadb.email.findMany({
    // Mailboxes are private: only the viewer's own synced email is ever used.
    where: { userId: user.id, isDeleted: false, OR: or },
    orderBy: { sentAt: "desc" },
    take: LIMITS.emails,
    select: { id: true, subject: true, fromName: true, fromEmail: true, folder: true, sentAt: true, bodyText: true },
  });
}

type ActivityRow = Awaited<ReturnType<typeof loadActivities>>[number];
type TaskRow = Awaited<ReturnType<typeof loadTasks>>[number];
type EmailRow = Awaited<ReturnType<typeof loadOwnEmails>>[number];

function activityItems(h: Handles, rows: ActivityRow[]): ContextItem[] {
  return rows.map((a) => ({
    handle: h.next("A"),
    ref: { type: "activity", id: a.id, label: `${a.type}: ${a.title}`, date: a.date.toISOString() },
    facts: {
      kind: a.type,
      status: a.status,
      date: iso(a.date),
      title: a.title,
      description: clip(a.description),
      outcome: clip(a.outcome, 300),
      by: a.created_by_user?.name ?? null,
    },
  }));
}

function taskItems(h: Handles, rows: TaskRow[]): ContextItem[] {
  return rows.map((t) => ({
    handle: h.next("T"),
    ref: { type: "task", id: t.id, label: `Task: ${t.title}`, date: t.dueDateAt?.toISOString() ?? null, href: hrefFor.task(t.id) },
    facts: {
      title: t.title,
      details: clip(t.content, 300),
      status: t.taskStatus === "COMPLETE" ? "complete" : "open",
      due: iso(t.dueDateAt),
      priority: t.priority,
      created: iso(t.createdAt),
    },
  }));
}

function emailItems(h: Handles, rows: EmailRow[]): ContextItem[] {
  return rows.map((e) => ({
    handle: h.next("E"),
    ref: { type: "email", id: e.id, label: `Email: ${e.subject ?? "(no subject)"}`, date: e.sentAt?.toISOString() ?? null, href: `/emails` },
    facts: {
      direction: e.folder === "SENT" ? "sent by us" : "received",
      date: iso(e.sentAt),
      subject: e.subject ?? null,
      from: e.fromName ?? e.fromEmail ?? null,
      excerpt: clip(e.bodyText, 700),
    },
  }));
}

const toActivityLite = (rows: ActivityRow[]): ActivityLite[] =>
  rows.map((a) => ({ id: a.id, type: a.type, title: a.title, date: a.date, status: a.status }));
const toTaskLite = (rows: TaskRow[]): TaskLite[] =>
  rows.map((t) => ({ id: t.id, title: t.title, dueDateAt: t.dueDateAt, taskStatus: t.taskStatus }));

const OPP_SELECT = {
  id: true, name: true, status: true, budget: true, expected_revenue: true, currency: true,
  close_date: true, stage_entered_at: true, next_step: true, description: true, createdAt: true,
  assigned_sales_stage: { select: { name: true, probability: true, order: true } },
  assigned_to_user: { select: { name: true } },
  _count: { select: { contacts: true } },
} as const;

type OppRow = {
  id: string; name: string | null; status: string | null; budget: unknown; expected_revenue: unknown; currency: string | null;
  close_date: Date | null; stage_entered_at: Date | null; next_step: string | null; description: string | null; createdAt: Date;
  assigned_sales_stage: { name: string; probability: number | null; order: number | null } | null;
  assigned_to_user: { name: string | null } | null;
  _count: { contacts: number };
};

function toOppLite(o: OppRow): OpportunityLite {
  return {
    id: o.id,
    name: o.name ?? "Untitled opportunity",
    status: o.status,
    value: num(o.expected_revenue) || num(o.budget),
    currency: o.currency,
    closeDate: o.close_date,
    stageName: o.assigned_sales_stage?.name ?? null,
    stageEnteredAt: o.stage_entered_at,
    nextStep: o.next_step,
    contactCount: o._count.contacts,
    createdAt: o.createdAt,
  };
}

function oppItems(h: Handles, rows: OppRow[]): ContextItem[] {
  return rows.map((o) => ({
    handle: h.next("O"),
    ref: { type: "opportunity", id: o.id, label: o.name ?? "Untitled opportunity", href: hrefFor.opportunity(o.id) },
    facts: {
      name: o.name ?? null,
      status: o.status,
      stage: o.assigned_sales_stage?.name ?? null,
      stageProbabilityConfigured: o.assigned_sales_stage?.probability ?? null,
      value: num(o.expected_revenue) || num(o.budget),
      currency: o.currency,
      closeDate: iso(o.close_date),
      inStageSince: iso(o.stage_entered_at),
      nextStep: clip(o.next_step, 200),
      owner: o.assigned_to_user?.name ?? null,
      linkedContacts: o._count.contacts,
    },
  }));
}

function finalize(subject: SubjectRef, profile: RecordContext["profile"], items: ContextItem[], signals: Signal[]): RecordContext {
  return { subject, profile, items, signals: rankSignals(dedupeSignals(signals)), sourceHash: fingerprint(profile, items) };
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export async function buildContactContext(user: AuthzUser, contactId: string, now = new Date()): Promise<RecordContext | null> {
  await assertCanReadContact(user, contactId);
  const c = await prismadb.crm_Contacts.findFirst({
    where: { id: contactId, deletedAt: null },
    select: {
      id: true, first_name: true, last_name: true, position: true, email: true, description: true, notes: true, tags: true,
      cratedAt: true, accountsIDs: true,
      assigned_accounts: { select: { id: true, name: true } },
      assigned_to_user: { select: { name: true } },
    },
  });
  if (!c) return null;
  const subject: SubjectRef = { type: "contact", id: c.id, label: personName(c), href: hrefFor.contact(c.id) };

  const opps = (await prismadb.crm_Opportunities.findMany({
    where: { AND: [opportunityReadScopeWhere(user), { deletedAt: null, contacts: { some: { contact_id: c.id } } }] },
    orderBy: { createdAt: "desc" },
    take: LIMITS.opportunities,
    select: OPP_SELECT,
  })) as OppRow[];
  const oppIds = opps.map((o) => o.id);

  const [activities, tasks, emails] = await Promise.all([
    loadActivities([{ entityType: "contact", ids: [c.id] }]),
    oppIds.length || c.accountsIDs
      ? loadTasks(user, { OR: [...(oppIds.length ? [{ opportunity_id: { in: oppIds } }] : []), ...(c.accountsIDs ? [{ account: c.accountsIDs }] : [])] })
      : Promise.resolve([] as TaskRow[]),
    loadOwnEmails(user, { contactIds: [c.id] }),
  ]);

  const h = new Handles();
  const items: ContextItem[] = [
    ...activityItems(h, activities),
    ...emailItems(h, emails),
    ...taskItems(h, tasks),
    ...oppItems(h, opps),
    ...(c.notes ?? []).filter(Boolean).slice(-10).map((n, i) => ({
      handle: h.next("N"),
      ref: { type: "note" as const, id: `${c.id}:note:${i}`, label: `Note: ${clip(n, 60)}`, href: subject.href },
      facts: { text: clip(n, 500) },
    })),
  ];

  const profile = {
    name: subject.label,
    position: c.position ?? null,
    company: c.assigned_accounts?.name ?? null,
    owner: c.assigned_to_user?.name ?? null,
    description: clip(c.description, 400),
    tags: (c.tags ?? []).join(", ") || null,
    since: iso(c.cratedAt),
  };

  const signals = [
    ...relationshipSignals({
      subject,
      activities: toActivityLite(activities),
      tasks: toTaskLite(tasks),
      hasOpenDeals: opps.some(isOpenDeal),
      now,
    }),
  ];
  return finalize(subject, profile, items, signals);
}

// ---------------------------------------------------------------------------
// Account (company)
// ---------------------------------------------------------------------------

export async function buildAccountContext(user: AuthzUser, accountId: string, now = new Date()): Promise<RecordContext | null> {
  await assertCanReadAccount(user, accountId);
  const a = await prismadb.crm_Accounts.findFirst({
    where: { id: accountId, deletedAt: null },
    select: {
      id: true, name: true, industry_type: { select: { name: true } }, type: true, status: true, description: true,
      website: true, employees: true, createdAt: true, assigned_to_user: { select: { name: true } },
    },
  });
  if (!a) return null;
  const subject: SubjectRef = { type: "account", id: a.id, label: a.name, href: hrefFor.account(a.id) };

  const [contacts, opps] = await Promise.all([
    prismadb.crm_Contacts.findMany({
      where: { AND: [contactReadScopeWhere(user), { accountsIDs: a.id, deletedAt: null }] },
      take: LIMITS.contacts,
      orderBy: { cratedAt: "desc" },
      select: { id: true, first_name: true, last_name: true, position: true, email: true },
    }),
    prismadb.crm_Opportunities.findMany({
      where: { AND: [opportunityReadScopeWhere(user), { account: a.id, deletedAt: null }] },
      orderBy: { createdAt: "desc" },
      take: LIMITS.opportunities,
      select: OPP_SELECT,
    }) as Promise<OppRow[]>,
  ]);
  const contactIds = contacts.map((c) => c.id);
  const oppIds = opps.map((o) => o.id);

  const [activities, tasks, emails, invoices] = await Promise.all([
    loadActivities([
      { entityType: "account", ids: [a.id] },
      { entityType: "contact", ids: contactIds },
      { entityType: "opportunity", ids: oppIds },
    ], 40),
    loadTasks(user, { OR: [{ account: a.id }, ...(oppIds.length ? [{ opportunity_id: { in: oppIds } }] : [])] }),
    loadOwnEmails(user, { contactIds, accountId: a.id }),
    prismadb.invoices.findMany({
      where: { AND: [invoiceReadScopeWhere(user), { accountId: a.id }] },
      orderBy: { dueDate: "desc" },
      take: LIMITS.invoices,
      select: { id: true, number: true, status: true, dueDate: true, issueDate: true, grandTotal: true, balanceDue: true, currency: true },
    }),
  ]);

  const h = new Handles();
  const items: ContextItem[] = [
    ...activityItems(h, activities),
    ...emailItems(h, emails),
    ...taskItems(h, tasks),
    ...oppItems(h, opps),
    ...contacts.map((c) => ({
      handle: h.next("C"),
      ref: { type: "contact" as const, id: c.id, label: personName(c), href: hrefFor.contact(c.id) },
      facts: { name: personName(c), position: c.position ?? null },
    })),
    ...invoices.map((i) => ({
      handle: h.next("I"),
      ref: { type: "invoice" as const, id: i.id, label: i.number ? `Invoice ${i.number}` : "Invoice (unnumbered)", date: i.dueDate?.toISOString() ?? null, href: hrefFor.invoice(i.id) },
      facts: { status: i.status, issued: iso(i.issueDate), due: iso(i.dueDate), total: num(i.grandTotal), balanceDue: num(i.balanceDue), currency: i.currency },
    })),
  ];

  const profile = {
    name: a.name,
    industry: a.industry_type?.name ?? null,
    type: a.type ?? null,
    status: a.status ?? null,
    owner: a.assigned_to_user?.name ?? null,
    employees: a.employees ?? null,
    description: clip(a.description, 400),
    since: iso(a.createdAt),
    contacts: contacts.length,
    openOpportunities: opps.filter(isOpenDeal).length,
  };

  const signals: Signal[] = [
    ...relationshipSignals({ subject, activities: toActivityLite(activities), tasks: toTaskLite(tasks), hasOpenDeals: opps.some(isOpenDeal), now }),
    ...invoiceSignals(
      invoices.map((i) => ({ id: i.id, number: i.number, dueDate: i.dueDate, balanceDue: num(i.balanceDue), currency: i.currency, status: i.status, accountId: a.id, accountName: a.name })),
      now,
    ),
  ];
  return finalize(subject, profile, items, signals);
}

// ---------------------------------------------------------------------------
// Opportunity (deal)
// ---------------------------------------------------------------------------

export async function buildOpportunityContext(user: AuthzUser, opportunityId: string, now = new Date()): Promise<RecordContext | null> {
  await assertCanReadOpportunity(user, opportunityId);
  const o = (await prismadb.crm_Opportunities.findFirst({
    where: { id: opportunityId, deletedAt: null },
    select: {
      ...OPP_SELECT,
      account: true,
      assigned_account: { select: { id: true, name: true } },
      assigned_type: { select: { name: true } },
      contacts: {
        take: LIMITS.contacts,
        where: { contact: { deletedAt: null } },
        select: { contact: { select: { id: true, first_name: true, last_name: true, position: true } } },
      },
    },
  })) as (OppRow & {
    account: string | null;
    assigned_account: { id: string; name: string } | null;
    assigned_type: { name: string } | null;
    contacts: { contact: { id: string; first_name: string | null; last_name: string; position: string | null } }[];
  }) | null;
  if (!o) return null;
  const lite = toOppLite(o);
  const subject: SubjectRef = { type: "opportunity", id: o.id, label: lite.name, href: hrefFor.opportunity(o.id) };
  const contactIds = o.contacts.map((c) => c.contact.id);

  const [activities, tasks, emails, stages, history] = await Promise.all([
    loadActivities([{ entityType: "opportunity", ids: [o.id] }, { entityType: "contact", ids: contactIds }]),
    loadTasks(user, { opportunity_id: o.id }),
    loadOwnEmails(user, { contactIds }),
    prismadb.crm_Opportunities_Sales_Stages.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, order: true } }),
    prismadb.crm_AuditLog.findMany({
      where: { entityType: "opportunity", entityId: o.id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, action: true, changes: true, createdAt: true },
    }),
  ]);
  const stageName = new Map(stages.map((s) => [s.id, s.name]));

  const h = new Handles();
  const historyItems: ContextItem[] = [];
  for (const entry of history) {
    const changes = Array.isArray(entry.changes) ? (entry.changes as { field?: string; old?: unknown; new?: unknown }[]) : [];
    for (const ch of changes) {
      if (!ch?.field || !["sales_stage", "close_date", "expected_revenue", "status"].includes(ch.field)) continue;
      const fmt = (v: unknown) => (ch.field === "sales_stage" ? stageName.get(String(v)) ?? "—" : v == null ? "—" : String(v).slice(0, 40));
      historyItems.push({
        handle: h.next("H"),
        ref: { type: "audit", id: entry.id, label: `${ch.field} changed`, date: entry.createdAt.toISOString(), href: subject.href },
        facts: { date: iso(entry.createdAt), field: ch.field, from: fmt(ch.old), to: fmt(ch.new) },
      });
    }
    if (entry.action === "created") {
      historyItems.push({
        handle: h.next("H"),
        ref: { type: "audit", id: entry.id, label: "Opportunity created", date: entry.createdAt.toISOString(), href: subject.href },
        facts: { date: iso(entry.createdAt), event: "created" },
      });
    }
  }

  const items: ContextItem[] = [
    ...activityItems(h, activities),
    ...emailItems(h, emails),
    ...taskItems(h, tasks),
    ...historyItems.slice(0, 20),
    ...o.contacts.map(({ contact: c }) => ({
      handle: h.next("C"),
      ref: { type: "contact" as const, id: c.id, label: personName(c), href: hrefFor.contact(c.id) },
      facts: { name: personName(c), position: c.position ?? null },
    })),
  ];

  const profile = {
    name: lite.name,
    company: o.assigned_account?.name ?? null,
    type: o.assigned_type?.name ?? null,
    status: o.status,
    stage: lite.stageName,
    pipeline: stages.map((s) => s.name).join(" → ") || null,
    inStageSince: iso(o.stage_entered_at),
    value: lite.value,
    currency: o.currency,
    closeDate: iso(o.close_date),
    nextStep: clip(o.next_step, 200),
    description: clip(o.description, 500),
    owner: o.assigned_to_user?.name ?? null,
    created: iso(o.createdAt),
  };

  const signals = dealSignals({ opportunity: lite, activities: toActivityLite(activities), tasks: toTaskLite(tasks), now });
  return finalize(subject, profile, items, signals);
}

export async function buildContext(user: AuthzUser, entityType: "contact" | "account" | "opportunity", id: string) {
  switch (entityType) {
    case "contact":
      return buildContactContext(user, id);
    case "account":
      return buildAccountContext(user, id);
    case "opportunity":
      return buildOpportunityContext(user, id);
  }
}

export type { EvidenceRef };
