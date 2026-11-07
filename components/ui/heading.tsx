import { Lock } from "lucide-react";
import type { ReactNode } from "react";

interface HeadingProps {
  title: string;
  description?: string;
  visibility?: string;
  /** Optional eyebrow shown above the title (e.g. module name). */
  eyebrow?: ReactNode;
  /** Primary page actions, right-aligned on wide screens. */
  actions?: ReactNode;
}

/**
 * Page heading. Compact, typographic — no decorative sizing.
 * Used by Container for every module page so headers stay consistent.
 */
const Heading = ({ title, description, visibility, eyebrow, actions }: HeadingProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-xs font-medium text-muted-foreground">{eyebrow}</div>
        ) : null}
        <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight text-foreground">
          {title}
          {visibility === "private" ? (
            <Lock className="h-4 w-4 text-muted-foreground" aria-label="Private" />
          ) : null}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default Heading;
