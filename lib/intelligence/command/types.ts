/** Wire types shared by the Command Center server action and UI. */

export interface RecordRow {
  id: string;
  href: string | null;
  title: string;
  subtitle?: string | null;
  meta?: string[];
  severity?: "high" | "medium" | "low" | null;
}

export type CommandBlock =
  | { type: "records"; title: string; entity: string; rows: RecordRow[]; total?: number; note?: string | null }
  | {
      type: "insight";
      title: string;
      href: string;
      summary: string | null;
      generatedAt: string | null;
      stale: boolean;
      points: { label: string; text: string }[];
      signals: RecordRow[];
    };

export interface TaskProposalItem {
  subjectType: "contact" | "account" | "opportunity" | "lead";
  subjectId: string;
  subjectLabel: string;
  subjectHref: string;
  title: string;
  dueInDays: number;
}

export interface Proposal {
  id: string;
  kind: "create_tasks";
  summary: string;
  items: TaskProposalItem[];
  /** Requested items that were dropped (not found / no permission). */
  skipped: string[];
}

export interface CommandTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CommandResult {
  reply: string;
  blocks: CommandBlock[];
  proposals: Proposal[];
  toolsUsed: string[];
}
