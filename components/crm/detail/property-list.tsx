import { cn } from "@/lib/utils";

/**
 * Compact key/value list for record sidebars. Empty values render as an
 * en dash so rows stay aligned and scannable.
 */
export function PropertySection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("py-4 first:pt-0", className)}>
      <h2 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function PropertyList({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2 text-sm">{children}</dl>;
}

export function Property({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words", empty && "text-muted-foreground/60")}>{empty ? "–" : children}</dd>
    </div>
  );
}
