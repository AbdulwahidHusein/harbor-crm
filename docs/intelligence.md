# NextCRM Intelligence

An intelligence layer built on top of the existing CRM data. It has two parts,
and the UI keeps them visibly apart:

| Layer | What it is | Needs AI? |
| --- | --- | --- |
| **Signals** | Rule-based facts computed live from records (quiet relationships, overdue tasks, meetings without an outcome, stalled deals, passed close dates, deals with no contacts, overdue invoices, uncontacted leads). Each signal lists the records that prove it. | No |
| **Insights** | An AI synthesis of one record's history (summary, commitments, open questions, engagement, risks, next steps). Every statement cites the records it is based on; uncited statements are discarded before storage. | Yes |

The product stays fully usable without an AI provider: signals, the daily
briefing, task creation and the Command Center quick reports all work with no key.

## Surfaces

- **Dashboard → Daily briefing** (`app/[locale]/(routes)/page.tsx`): today's three priorities, plus
  customers needing attention, overdue commitments, stalled opportunities and pending follow-ups.
  Every item has its evidence, a *Create task* action and a *Dismiss* (hidden 7 days; it returns if still true).
  With AI configured, the three priorities are re-ordered and explained — the model can only pick from existing items.
- **Contact / company detail → Relationship intelligence**; **opportunity detail → Deal intelligence**
  (`components/intelligence/record-intelligence.tsx`). Shows when the summary was generated, from how many records,
  and flags it as out of date when the underlying records change.
- **Command Center** (`/intelligence`, also reachable from ⌘K → "Ask Command Center"). Natural-language questions over
  CRM data via a tool-calling loop. Quick reports run the same tools without a model.

## Architecture

```
lib/intelligence/
  signals.ts     pure rule functions (unit tested)
  context.ts     scoped context builders for contact / account / opportunity
  ground.ts      citation validation + resolution (unit tested)
  llm.ts         OpenAI client via getApiKey(), grounding rules, structured output
  schemas.ts     zod schemas for structured outputs
  insights.ts    cache lifecycle: read, request, generate
  briefing.ts    per-user daily briefing + optional AI focus line
  command/       Command Center tools, loop and wire types
actions/intelligence/   server actions (auth + input validation)
inngest/functions/intelligence/generate-insight.ts   background generation
```

**Authorization.** Every context builder starts with the existing `assertCanRead*` helper and loads
linked records only through the existing read scopes (`contactReadScopeWhere`, `opportunityReadScopeWhere`,
`crmTaskReadScopeWhere`, `invoiceReadScopeWhere`, …). Email is taken only from the viewer's own mailbox.
Insights are cached **per viewer** (`crm_AI_Insights` is unique on kind + record + user), so one user's
summary — which may reflect their private email — is never shown to another. Partners are excluded from
the AI surfaces; the background job re-reads the user's role from the database before running.

**Grounding.** The model sees records as short handles (`A1` activity, `E2` email, `T3` task, `O1` deal,
`H1` stage change, `N1` note, `I1` invoice, `C1` contact), never database ids. Each output item must cite handles.
`ground.ts` drops anything citing nothing, or only unknown handles, and clips lengths. Handles are resolved
back to links for the UI so users can open the exact records behind a statement. Deal risk is expressed as
evidence, never as a probability.

**No silent writes.** AI output is stored only in `crm_AI_Insights`. CRM records change only through explicit
user actions: *Create task* (a confirmation dialog) and Command Center proposals (a confirmation card listing
every affected record; each item is re-authorized on execution). `__tests__/intelligence/no-silent-writes.test.ts`
enforces this statically.

**Caching and staleness.** `sourceHash` fingerprints the records an insight was built from (absolute dates only,
so it does not change just because a day passed). When the live hash differs, the panel shows
"Records changed since this summary was generated" with a one-click update. First view of a record generates
automatically; regeneration is rate-limited per record (20 s).

**Background jobs.** Generation is queued as `intelligence/insight.requested` and handled by Inngest with
concurrency 1 per user. If Inngest is unreachable (or `NEXTCRM_AI_INLINE=1`), it runs inline in the request.
Jobs that do not finish within 3 minutes are treated as failed and can be retried.

**Failure handling and logging.** Provider errors become a short, user-safe message on the panel; previous
insights remain visible. `log.ts` logs only error class, HTTP status and provider error code — never prompts,
completions or record contents.

## Setup

1. Apply the migration: `pnpm db:migrate` (adds `crm_AI_Insights`, `crm_AI_Dismissals`; additive only).
2. Provide an OpenAI key: `OPENAI_API_KEY` in the environment, or Administration → LLM keys (system-wide),
   or a user's own key in their profile. Resolution order is unchanged (`lib/api-keys.ts`).
3. Optional: `NEXTCRM_AI_MODEL` (default `gpt-5-mini`; any chat model with structured outputs and tool calling).
4. For background generation run Inngest as usual (`pnpm inngest:up`). Without it, generation runs inline.

## Data sent to the model

For a record insight: the record's profile fields, up to 30 recent linked activities (text clipped to 600 chars),
up to 8 of the viewer's own linked emails (excerpt clipped to 700 chars), up to 20 tasks, linked deals, contacts,
invoices (company only) and stage history (deals only). For the briefing focus: only signal titles and details.
For the Command Center: the conversation (last 8 turns) and compact tool results.

## Known limitations / follow-ups

- New UI strings are English only; they are not yet in `locales/*.json`.
- Leads have signals in the briefing and Command Center but no detail-page insight panel yet.
- Signal thresholds live in `THRESHOLDS` (`signals.ts`); they could be moved into Admin → Funnel settings.
