/**
 * Command Center tools. Each tool runs as the signed-in user through the same
 * read scopes as the rest of the app (search tools reuse the MCP server's
 * handlers). Tools never write: mutations are returned as proposals that the
 * user must confirm in the UI, and are re-authorized when executed.
 */
import { randomUUID } from "crypto";
import { z } from "zod";
import { prismadb } from "@/lib/prisma";
import type { AuthzUser } from "@/lib/authz";
import {
  assertCanWriteAccount,
  assertCanWriteContact,
  assertCanWriteLead,
  assertCanWriteOpportunity,
  crmTaskReadScopeWhere,
  leadReadScopeWhere,
  opportunityReadScopeWhere,
} from "@/lib/authz/scopes/crm";
import { invoiceReadScopeWhere } from "@/lib/invoices/permissions";
import { runAsActor } from "@/lib/plugins/actor";
import { crmAccountTools } from "@/lib/mcp/tools/crm-accounts";
import { crmContactTools } from "@/lib/mcp/tools/crm-contacts";
import { crmLeadTools } from "@/lib/mcp/tools/crm-leads";
import { crmOpportunityTools } from "@/lib/mcp/tools/crm-opportunities";
import { DAY_MS, daysSince, hrefFor, invoiceSignals, isOpenDeal, lastInteraction, leadSignals, plural, type ActivityLite } from "../signals";
import { getInsightView, generateInsight } from "../insights";
import type { CommandBlock, Proposal, RecordRow, TaskProposalItem } from "./types";

export interface ToolOutput {
  /** Compact JSON-able result given back to the model. */
  forModel: unknown;
  block?: CommandBlock;
  proposal?: Proposal;
}

export interface CommandTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: S;
  run(user: AuthzUser, args: z.infer<S>): Promise<ToolOutput>;
}

const define = <S extends z.ZodType>(t: CommandTool<S>) => t;
const money = (v: unknown, cur?: string | null) => `${Math.round(Number(v ?? 0)).toLocaleString("en-US")}${cur ? ` ${cur}` : ""}`;
const person = (c: { first_name?: string | null; last_name?: string | null }) => [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";

/** Call an existing MCP tool handler in-process, as this user. */
async function callMcp<T = { data: any[]; total: number }>(
  tools: readonly { name: string; handler: (...a: any[]) => unknown }[],
  name: string,
  user: AuthzUser,
  args: Record<string, unknown>,
): Promise<T> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Tool ${name} not available`);
  return runAsActor({ type: "user", userId: user.id, role: user.role }, () => tool.handler(args, user.id, user)) as Promise<T>;
}

async function activityMap(entityType: string, ids: string[]): Promise<Map<string, ActivityLite[]>> {
  const map = new Map<string, ActivityLite[]>();
  if (!ids.length) return map;
  const links = await prismadb.crm_ActivityLinks.findMany({ where: { entityType, entityId: { in: ids } }, select: { activityId: true, entityId: true }, take: 5000 });
  const acts = await prismadb.crm_Activities.findMany({
    where: { id: { in: Array.from(new Set(links.map((l) => l.activityId))) }, deletedAt: null },
    select: { id: true, type: true, title: true, date: true, status: true },
  });
  const byId = new Map(acts.map((a) => [a.id, a as ActivityLite]));
  for (const l of links) {
    const a = byId.get(l.activityId);
    if (a) map.set(l.entityId, [...(map.get(l.entityId) ?? []), a]);
  }
  return map;
}

// ---------------------------------------------------------------------------

const searchRecords = define({
  name: "search_records",
  description:
    "Find contacts, companies (accounts), opportunities or leads by name, email or phone. Use this to resolve a name the user mentions into record ids before other tools.",
  schema: z.object({
    entity: z.enum(["contact", "account", "opportunity", "lead"]),
    query: z.string().min(1).max(100),
    limit: z.number().int().min(1).max(25).nullable(),
  }),
  async run(user, { entity, query, limit }) {
    const args = { query, limit: limit ?? 10, offset: 0 };
    let rows: RecordRow[] = [];
    let total = 0;
    if (entity === "contact") {
      const r = await callMcp(crmContactTools, "crm_search_contacts", user, args);
      total = r.total;
      rows = r.data.filter((c: any) => !c.deletedAt).map((c: any) => ({ id: c.id, href: hrefFor.contact(c.id), title: person(c), subtitle: [c.position, c.email].filter(Boolean).join(" · ") || null }));
    } else if (entity === "account") {
      const r = await callMcp(crmAccountTools, "crm_search_accounts", user, args);
      total = r.total;
      rows = r.data.filter((a: any) => !a.deletedAt).map((a: any) => ({ id: a.id, href: hrefFor.account(a.id), title: a.name, subtitle: [a.type, a.billing_city].filter(Boolean).join(" · ") || null }));
    } else if (entity === "opportunity") {
      const r = await callMcp(crmOpportunityTools, "crm_search_opportunities", user, args);
      total = r.total;
      rows = r.data.filter((o: any) => !o.deletedAt).map((o: any) => ({ id: o.id, href: hrefFor.opportunity(o.id), title: o.name ?? "Untitled", subtitle: [o.status, money(o.expected_revenue || o.budget, o.currency)].filter(Boolean).join(" · ") }));
    } else {
      const r = await callMcp(crmLeadTools, "crm_search_leads", user, args);
      total = r.total;
      rows = r.data.filter((l: any) => !l.deletedAt).map((l: any) => ({ id: l.id, href: hrefFor.lead(l.id), title: [l.firstName, l.lastName].filter(Boolean).join(" "), subtitle: [l.company, l.email].filter(Boolean).join(" · ") || null }));
    }
    return {
      forModel: { total, results: rows.map((r) => ({ id: r.id, name: r.title, detail: r.subtitle })) },
      block: { type: "records", title: `${entity === "account" ? "Companies" : entity[0].toUpperCase() + entity.slice(1) + "s"} matching “${query}”`, entity, rows, total },
    };
  },
});

const inactiveOpportunities = define({
  name: "find_inactive_opportunities",
  description: "List open opportunities with no completed activity in the last N days (default 14). Optionally only the user's own deals.",
  schema: z.object({ days: z.number().int().min(1).max(365).nullable(), mineOnly: z.boolean().nullable() }),
  async run(user, { days, mineOnly }) {
    const d = days ?? 14;
    const now = new Date();
    const opps = await prismadb.crm_Opportunities.findMany({
      where: {
        AND: [
          opportunityReadScopeWhere(user),
          { deletedAt: null, status: { in: ["ACTIVE", "PENDING"] } },
          ...(mineOnly ? [{ assigned_to: user.id }] : []),
        ],
      },
      take: 300,
      orderBy: { expected_revenue: "desc" },
      select: { id: true, name: true, status: true, expected_revenue: true, budget: true, currency: true, createdAt: true, assigned_sales_stage: { select: { name: true } }, assigned_account: { select: { name: true } }, assigned_to_user: { select: { name: true } } },
    });
    const acts = await activityMap("opportunity", opps.map((o) => o.id));
    const rows: (RecordRow & { quiet: number })[] = [];
    for (const o of opps) {
      if (!isOpenDeal(o)) continue;
      const last = lastInteraction(acts.get(o.id) ?? [], now);
      const quiet = daysSince(last?.date ?? o.createdAt, now) ?? 0;
      if (quiet < d) continue;
      rows.push({
        id: o.id,
        href: hrefFor.opportunity(o.id),
        title: o.name ?? "Untitled",
        subtitle: [o.assigned_account?.name, o.assigned_sales_stage?.name].filter(Boolean).join(" · ") || null,
        meta: [money(o.expected_revenue || o.budget, o.currency), last ? `Last activity ${plural(quiet, "day")} ago` : "No activity logged", o.assigned_to_user?.name ?? "Unassigned"],
        severity: quiet >= 30 ? "high" : "medium",
        quiet,
      });
    }
    rows.sort((a, b) => b.quiet - a.quiet);
    return {
      forModel: { days: d, count: rows.length, opportunities: rows.slice(0, 40).map((r) => ({ id: r.id, name: r.title, account: r.subtitle, daysQuiet: r.quiet, value: r.meta?.[0] })) },
      block: { type: "records", title: `Open opportunities without activity in ${plural(d, "day")}`, entity: "opportunity", rows: rows.slice(0, 50), total: rows.length },
    };
  },
});

const overdueInvoices = define({
  name: "find_overdue_invoices",
  description: "List customers with unpaid invoices past their due date.",
  schema: z.object({}),
  async run(user) {
    const now = new Date();
    const inv = await prismadb.invoices.findMany({
      where: { AND: [invoiceReadScopeWhere(user), { status: { in: ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"] }, dueDate: { lt: now }, balanceDue: { gt: 0 } }] },
      take: 200,
      orderBy: { dueDate: "asc" },
      select: { id: true, number: true, dueDate: true, balanceDue: true, currency: true, status: true, account: { select: { id: true, name: true } } },
    });
    const sig = invoiceSignals(
      inv.filter((i) => i.account).map((i) => ({ id: i.id, number: i.number, dueDate: i.dueDate, balanceDue: Number(i.balanceDue), currency: i.currency, status: i.status, accountId: i.account!.id, accountName: i.account!.name })),
      now,
    );
    const rows: RecordRow[] = sig.map((s) => ({ id: s.evidence[0].id, href: s.evidence[0].href ?? null, title: s.title, subtitle: s.detail, meta: [s.subject.label], severity: s.severity }));
    const byCustomer = new Map<string, { name: string; count: number }>();
    for (const s of sig) byCustomer.set(s.subject.id, { name: s.subject.label, count: (byCustomer.get(s.subject.id)?.count ?? 0) + 1 });
    return {
      forModel: { invoices: sig.length, customers: Array.from(byCustomer.entries()).map(([id, v]) => ({ accountId: id, name: v.name, overdueInvoices: v.count })) },
      block: { type: "records", title: "Overdue invoices", entity: "invoice", rows, total: rows.length },
    };
  },
});

const leadsNeedingFollowUp = define({
  name: "find_leads_needing_followup",
  description: "List open leads (created in the last 90 days) with no follow-up activity in the last 7 days.",
  schema: z.object({ mineOnly: z.boolean().nullable() }),
  async run(user, { mineOnly }) {
    const now = new Date();
    const leads = await prismadb.crm_Leads.findMany({
      where: { AND: [leadReadScopeWhere(user), { deletedAt: null, createdAt: { gte: new Date(now.getTime() - 90 * DAY_MS) } }, ...(mineOnly ? [{ assigned_to: user.id }] : [])] },
      take: 200,
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, company: true, createdAt: true, lead_status: { select: { name: true } }, assigned_to_user: { select: { name: true } } },
    });
    const acts = await activityMap("lead", leads.map((l) => l.id));
    const rows: RecordRow[] = [];
    for (const l of leads) {
      const s = leadSignals({ id: l.id, name: [l.firstName, l.lastName].filter(Boolean).join(" "), company: l.company, createdAt: l.createdAt, statusName: l.lead_status?.name ?? null }, acts.get(l.id) ?? [], now)[0];
      if (s) rows.push({ id: l.id, href: hrefFor.lead(l.id), title: s.subject.label, subtitle: s.detail, meta: [l.lead_status?.name ?? "No status", l.assigned_to_user?.name ?? "Unassigned"], severity: s.severity });
    }
    return {
      forModel: { count: rows.length, leads: rows.slice(0, 40).map((r) => ({ id: r.id, name: r.title, detail: r.subtitle })) },
      block: { type: "records", title: "Leads needing follow-up", entity: "lead", rows: rows.slice(0, 50), total: rows.length },
    };
  },
});

const myTasks = define({
  name: "list_my_tasks",
  description: "List the user's open CRM tasks, optionally only overdue ones.",
  schema: z.object({ overdueOnly: z.boolean().nullable() }),
  async run(user, { overdueOnly }) {
    const now = new Date();
    const tasks = await prismadb.crm_Accounts_Tasks.findMany({
      where: { AND: [crmTaskReadScopeWhere(user), { user: user.id, taskStatus: { not: "COMPLETE" } }, ...(overdueOnly ? [{ dueDateAt: { lt: now } }] : [])] },
      orderBy: { dueDateAt: "asc" },
      take: 50,
      select: { id: true, title: true, dueDateAt: true, priority: true, crm_accounts: { select: { name: true } }, opportunity: { select: { name: true } } },
    });
    const rows: RecordRow[] = tasks.map((t) => {
      const late = t.dueDateAt && t.dueDateAt < now ? daysSince(t.dueDateAt, now) : null;
      return {
        id: t.id,
        href: hrefFor.task(t.id),
        title: t.title,
        subtitle: [t.opportunity?.name, t.crm_accounts?.name].filter(Boolean).join(" · ") || null,
        meta: [t.dueDateAt ? (late ? `${plural(late, "day")} overdue` : `Due ${t.dueDateAt.toISOString().slice(0, 10)}`) : "No due date", t.priority],
        severity: late ? (late > 7 ? "high" : "medium") : null,
      };
    });
    return {
      forModel: { count: rows.length, tasks: rows.map((r) => ({ id: r.id, title: r.title, related: r.subtitle, due: r.meta?.[0] })) },
      block: { type: "records", title: overdueOnly ? "Your overdue tasks" : "Your open tasks", entity: "task", rows, total: rows.length },
    };
  },
});

const summarizeRelationship = define({
  name: "summarize_record",
  description:
    "Summarize the relationship with a contact or company, or the state of an opportunity, using its Intelligence insight and recorded signals. Requires a record id (use search_records first).",
  schema: z.object({ entity: z.enum(["contact", "account", "opportunity"]), id: z.string().uuid() }),
  async run(user, { entity, id }) {
    let view = await getInsightView(user, entity, id);
    if (!view) return { forModel: { error: "Record not found or not accessible." } };
    if (view.aiConfigured && (!view.insight || view.stale)) {
      await generateInsight(user, entity, id);
      view = (await getInsightView(user, entity, id)) ?? view;
    }
    const p = (view.insight ?? {}) as any;
    const points: { label: string; text: string }[] = [];
    const add = (label: string, items?: any[], key = "text") => items?.slice(0, 3).forEach((i) => points.push({ label, text: i[key] }));
    add("Commitment", p.commitments?.filter((c: any) => c.status !== "fulfilled"));
    add("Open question", p.openQuestions);
    add("Risk", p.risks, "risk");
    add("Next action", p.nextActions ?? p.nextSteps, "action");
    const summary: string | null = p.summary ?? p.progression ?? null;
    const signals: RecordRow[] = view.signals.slice(0, 6).map((s) => ({ id: s.key, href: s.subject.href, title: s.title, subtitle: s.detail, severity: s.severity }));
    return {
      forModel: { name: view.subject.label, summary, keyPoints: points, recordedSignals: view.signals.slice(0, 8).map((s) => s.title), aiSummaryAvailable: Boolean(summary) },
      block: { type: "insight", title: view.subject.label, href: view.subject.href, summary, generatedAt: view.generatedAt, stale: view.stale, points, signals },
    };
  },
});

async function writableSubject(user: AuthzUser, type: TaskProposalItem["subjectType"], id: string): Promise<{ label: string; href: string } | null> {
  try {
    if (type === "contact") {
      await assertCanWriteContact(user, id);
      const c = await prismadb.crm_Contacts.findFirst({ where: { id, deletedAt: null }, select: { first_name: true, last_name: true } });
      return c ? { label: person(c), href: hrefFor.contact(id) } : null;
    }
    if (type === "account") {
      await assertCanWriteAccount(user, id);
      const a = await prismadb.crm_Accounts.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
      return a ? { label: a.name, href: hrefFor.account(id) } : null;
    }
    if (type === "opportunity") {
      await assertCanWriteOpportunity(user, id);
      const o = await prismadb.crm_Opportunities.findFirst({ where: { id, deletedAt: null }, select: { name: true } });
      return o ? { label: o.name ?? "Opportunity", href: hrefFor.opportunity(id) } : null;
    }
    await assertCanWriteLead(user, id);
    const l = await prismadb.crm_Leads.findFirst({ where: { id, deletedAt: null }, select: { firstName: true, lastName: true } });
    return l ? { label: [l.firstName, l.lastName].filter(Boolean).join(" "), href: hrefFor.lead(id) } : null;
  } catch {
    return null;
  }
}

const proposeTasks = define({
  name: "propose_follow_up_tasks",
  description:
    "Prepare follow-up tasks for one or more records. This does NOT create anything: the user reviews the list and confirms in the interface. Use record ids from earlier tool results.",
  schema: z.object({
    tasks: z
      .array(
        z.object({
          subjectType: z.enum(["contact", "account", "opportunity", "lead"]),
          subjectId: z.string().uuid(),
          title: z.string().min(3).max(200),
          dueInDays: z.number().int().min(0).max(60).nullable(),
        }),
      )
      .min(1)
      .max(20),
  }),
  async run(user, { tasks }) {
    const items: TaskProposalItem[] = [];
    const skipped: string[] = [];
    for (const t of tasks) {
      const s = await writableSubject(user, t.subjectType, t.subjectId);
      if (!s) {
        skipped.push(`${t.subjectType} ${t.subjectId.slice(0, 8)}… (not found or no permission)`);
        continue;
      }
      items.push({ subjectType: t.subjectType, subjectId: t.subjectId, subjectLabel: s.label, subjectHref: s.href, title: t.title, dueInDays: t.dueInDays ?? 1 });
    }
    const proposal: Proposal | undefined = items.length
      ? { id: randomUUID(), kind: "create_tasks", summary: `Create ${plural(items.length, "follow-up task")}`, items, skipped }
      : undefined;
    return {
      forModel: { proposed: items.length, skipped, note: "Awaiting user confirmation in the UI. Tell the user to review and confirm." },
      proposal,
    };
  },
});

export const COMMAND_TOOLS: CommandTool[] = [
  searchRecords,
  inactiveOpportunities,
  overdueInvoices,
  leadsNeedingFollowUp,
  myTasks,
  summarizeRelationship,
  proposeTasks,
] as CommandTool[];

/** Deterministic shortcuts that work without any AI provider. */
export const QUICK_COMMANDS = {
  stale_opportunities: { label: "Opportunities without activity in 14 days", tool: "find_inactive_opportunities", args: { days: 14, mineOnly: null } },
  overdue_invoices: { label: "Customers with overdue invoices", tool: "find_overdue_invoices", args: {} },
  leads_follow_up: { label: "Leads that need follow-up", tool: "find_leads_needing_followup", args: { mineOnly: null } },
  my_overdue_tasks: { label: "My overdue tasks", tool: "list_my_tasks", args: { overdueOnly: true } },
} as const;
export type QuickCommand = keyof typeof QUICK_COMMANDS;
