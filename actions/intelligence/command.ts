"use server";
import { z } from "zod";
import { requireAuthenticated, AuthenticationError } from "@/lib/authz";
import { runCommand, runQuickCommand } from "@/lib/intelligence/command/run";
import { QUICK_COMMANDS, type QuickCommand } from "@/lib/intelligence/command/tools";
import type { CommandResult } from "@/lib/intelligence/command/types";
import { AiNotConfiguredError } from "@/lib/intelligence/llm";
import { logAiError } from "@/lib/intelligence/log";
import { createTaskFromRecommendation } from "./recommendations";

const historySchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
  .min(1)
  .max(20)
  .refine((h) => h[h.length - 1].role === "user", "Last turn must be from the user");

type Res<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function runCommandAction(history: unknown): Promise<Res<CommandResult>> {
  const parsed = historySchema.safeParse(history);
  if (!parsed.success) return { error: "Please enter a request." };
  try {
    const user = await requireAuthenticated();
    return { data: await runCommand(user, parsed.data) };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "Please sign in again." };
    if (e instanceof AiNotConfiguredError) return { error: "AI_NOT_CONFIGURED" };
    logAiError("action.command", e);
    return { error: "Something went wrong running that request." };
  }
}

export async function runQuickCommandAction(name: string): Promise<Res<CommandResult>> {
  if (!(name in QUICK_COMMANDS)) return { error: "Unknown command" };
  try {
    const user = await requireAuthenticated();
    return { data: await runQuickCommand(user, name as QuickCommand) };
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "Please sign in again." };
    logAiError("action.quick", e);
    return { error: "Something went wrong running that request." };
  }
}

const proposalItems = z
  .array(
    z.object({
      subjectType: z.enum(["contact", "account", "opportunity", "lead"]),
      subjectId: z.string().uuid(),
      title: z.string().trim().min(3).max(200),
      dueInDays: z.number().int().min(0).max(60),
    }),
  )
  .min(1)
  .max(20);

/**
 * Execute a confirmed task proposal. Each item is re-authorized and created
 * individually; the response reports success or failure per record.
 */
export async function executeTaskProposal(items: unknown) {
  const parsed = proposalItems.safeParse(items);
  if (!parsed.success) return { error: "The proposal is invalid." };
  const results: { subjectId: string; ok: boolean; taskId?: string; error?: string }[] = [];
  for (const item of parsed.data) {
    const res = await createTaskFromRecommendation({ ...item, details: "Created from Command Center." });
    results.push(res.data ? { subjectId: item.subjectId, ok: true, taskId: res.data.id } : { subjectId: item.subjectId, ok: false, error: res.error });
  }
  return { data: results };
}
