import { cn } from "@/lib/utils";

/**
 * Harbor mark: two piers and the water line between them — reads as an "H"
 * and as a harbor entrance. Single-color, works at 16px.
 */
export function HarborMark({ className, title = "Harbor CRM" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label={title} className={cn("h-7 w-7 shrink-0", className)}>
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path d="M10 7.5v17M22 7.5v17" stroke="var(--harbor-mark-fg, #fff)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M6.5 17.2c2.1 0 2.1-1.6 4.2-1.6s2.1 1.6 4.2 1.6 2.1-1.6 4.2-1.6 2.1 1.6 4.2 1.6 2.1-1.6 4.2-1.6"
        fill="none"
        stroke="var(--harbor-mark-fg, #fff)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HarborWordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <HarborMark className={markClassName} />
      <span className="text-[15px] font-semibold tracking-tight">Harbor CRM</span>
    </span>
  );
}
