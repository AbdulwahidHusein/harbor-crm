import { inngest } from "@/inngest/client";
import { prismadb } from "@/lib/prisma";
import { mapLegacyRole } from "@/lib/authz/roles";
import { generateInsight, INSIGHT_EVENT, type InsightEntity } from "@/lib/intelligence/insights";

/**
 * Background generation of a Relationship / Deal insight.
 * Runs as the requesting user (role re-read from the DB) so the context is
 * gathered with exactly that user's read scope.
 */
export const intelligenceGenerateInsight = inngest.createFunction(
  {
    id: "intelligence-generate-insight",
    name: "Intelligence: Generate insight",
    // One job per user at a time keeps provider usage predictable.
    concurrency: { limit: 1, key: "event.data.userId" },
    retries: 1,
    triggers: [{ event: INSIGHT_EVENT }],
  },
  async ({ event }: { event: { data: { entityType: InsightEntity; entityId: string; userId: string } } }) => {
    const { entityType, entityId, userId } = event.data;
    const dbUser = await prismadb.users.findUnique({ where: { id: userId }, select: { id: true, role: true, userStatus: true } });
    if (!dbUser || dbUser.userStatus !== "ACTIVE") return { skipped: "user inactive" };
    await generateInsight({ id: dbUser.id, role: mapLegacyRole(dbUser.role) }, entityType, entityId);
    return { done: true };
  },
);
