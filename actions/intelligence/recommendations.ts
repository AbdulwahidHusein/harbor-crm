"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import {
  requireAuthenticated,
  assertCanWriteAccount,
  assertCanWriteOpportunity,
  assertCanWriteContact,
  assertCanWriteLead,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/authz";
import { logAiError } from "@/lib/intelligence/log";

const taskInput = z.object({
  subjectType: z.enum(["contact", "account", "opportunity", "lead"]),
  subjectId: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  details: z.string().trim().max(2000).optional(),
  dueInDays: z.number().int().min(0).max(365).default(1),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export type CreateTaskInput = z.input<typeof taskInput>;

/**
 * Create a CRM task from a recommendation. Explicit user action only — nothing
 * in Intelligence creates tasks on its own. Requires write access to the
 * subject; the task is assigned to the caller and linked to the subject's
 * account / opportunity where one exists.
 */
export async function createTaskFromRecommendation(args: CreateTaskInput) {
  const parsed = taskInput.safeParse(args);
  if (!parsed.success) return { error: "Please check the task title and due date." };
  const { subjectType, subjectId, title, details, dueInDays, priority } = parsed.data;
  try {
    const user = await requireAuthenticated();
    let account: string | null = null;
    let opportunity: string | null = null;

    if (subjectType === "account") {
      await assertCanWriteAccount(user, subjectId);
      account = subjectId;
    } else if (subjectType === "opportunity") {
      await assertCanWriteOpportunity(user, subjectId);
      const o = await prismadb.crm_Opportunities.findFirst({ where: { id: subjectId, deletedAt: null }, select: { account: true } });
      if (!o) return { error: "Opportunity not found." };
      opportunity = subjectId;
      account = o.account;
    } else if (subjectType === "contact") {
      await assertCanWriteContact(user, subjectId);
      const c = await prismadb.crm_Contacts.findFirst({ where: { id: subjectId, deletedAt: null }, select: { accountsIDs: true } });
      if (!c) return { error: "Contact not found." };
      account = c.accountsIDs;
    } else {
      await assertCanWriteLead(user, subjectId);
      const l = await prismadb.crm_Leads.findFirst({ where: { id: subjectId, deletedAt: null }, select: { accountsIDs: true } });
      if (!l) return { error: "Lead not found." };
      account = l.accountsIDs;
    }

    const due = new Date();
    due.setHours(17, 0, 0, 0);
    due.setDate(due.getDate() + dueInDays);

    const task = await prismadb.crm_Accounts_Tasks.create({
      data: {
        v: 0,
        title,
        content: details ?? "",
        priority,
        dueDateAt: due,
        account,
        opportunity_id: opportunity,
        user: user.id,
        createdBy: user.id,
        updatedBy: user.id,
        taskStatus: "ACTIVE",
      },
      select: { id: true, title: true, dueDateAt: true },
    });
    revalidatePath("/[locale]/(routes)", "layout");
    return { data: { id: task.id, title: task.title, dueDateAt: task.dueDateAt?.toISOString() ?? null } };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "Please sign in again." };
    if (e instanceof AuthorizationError) return { error: "You don't have permission to add tasks to this record." };
    logAiError("action.createTask", e);
    return { error: "The task could not be created." };
  }
}

const SIGNAL_KEY = /^[a-z_]{3,40}:[0-9a-f-]{36}$/;

/** Hide a briefing item for `days` days. If the condition still holds afterwards it returns. */
export async function dismissRecommendation(args: { signalKey: string; days?: number }) {
  if (!SIGNAL_KEY.test(args.signalKey)) return { error: "INVALID_INPUT" };
  const days = Math.min(Math.max(Math.trunc(args.days ?? 7), 1), 90);
  try {
    const user = await requireAuthenticated();
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    await prismadb.crm_AI_Dismissals.upsert({
      where: { userId_signalKey: { userId: user.id, signalKey: args.signalKey } },
      create: { userId: user.id, signalKey: args.signalKey, expiresAt },
      update: { dismissedAt: new Date(), expiresAt },
    });
    return { data: { signalKey: args.signalKey, expiresAt: expiresAt.toISOString() } };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "UNAUTHORIZED" };
    logAiError("action.dismiss", e);
    return { error: "FAILED" };
  }
}

export async function undoDismissRecommendation(args: { signalKey: string }) {
  if (!SIGNAL_KEY.test(args.signalKey)) return { error: "INVALID_INPUT" };
  try {
    const user = await requireAuthenticated();
    await prismadb.crm_AI_Dismissals.deleteMany({ where: { userId: user.id, signalKey: args.signalKey } });
    return { data: true };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "UNAUTHORIZED" };
    logAiError("action.undoDismiss", e);
    return { error: "FAILED" };
  }
}
