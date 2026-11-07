-- NextCRM Intelligence: cached AI insights + briefing dismissals.
-- Additive only; no existing table is altered. Safe to re-run.

DO $$ BEGIN
  CREATE TYPE "crm_AI_Insight_Status" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "crm_AI_Insights" (
    "id"          UUID                    NOT NULL DEFAULT gen_random_uuid(),
    "kind"        TEXT                    NOT NULL,
    "entityType"  TEXT                    NOT NULL,
    "entityId"    UUID                    NOT NULL,
    "userId"      UUID                    NOT NULL,
    "status"      "crm_AI_Insight_Status" NOT NULL DEFAULT 'PENDING',
    "payload"     JSONB,
    "sources"     JSONB,
    "sourceHash"  TEXT,
    "model"       TEXT,
    "error"       TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)            NOT NULL,

    CONSTRAINT "crm_AI_Insights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_AI_Insights_kind_entityType_entityId_userId_key"
    ON "crm_AI_Insights"("kind", "entityType", "entityId", "userId");
CREATE INDEX IF NOT EXISTS "crm_AI_Insights_userId_idx" ON "crm_AI_Insights"("userId");
CREATE INDEX IF NOT EXISTS "crm_AI_Insights_entityType_entityId_idx"
    ON "crm_AI_Insights"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "crm_AI_Dismissals" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"      UUID         NOT NULL,
    "signalKey"   TEXT         NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"   TIMESTAMP(3),

    CONSTRAINT "crm_AI_Dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_AI_Dismissals_userId_signalKey_key"
    ON "crm_AI_Dismissals"("userId", "signalKey");
CREATE INDEX IF NOT EXISTS "crm_AI_Dismissals_userId_idx" ON "crm_AI_Dismissals"("userId");

DO $$ BEGIN
  ALTER TABLE "crm_AI_Insights"
    ADD CONSTRAINT "crm_AI_Insights_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "crm_AI_Dismissals"
    ADD CONSTRAINT "crm_AI_Dismissals_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
