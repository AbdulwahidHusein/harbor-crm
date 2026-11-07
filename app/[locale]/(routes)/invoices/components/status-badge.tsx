"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Semantic, token-based status colors (no per-status hues).
const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ISSUED: "bg-primary/10 text-primary",
  SENT: "bg-primary/10 text-primary",
  PARTIALLY_PAID: "bg-warning/10 text-warning",
  PAID: "bg-success/10 text-success",
  OVERDUE: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground line-through",
  DISPUTED: "bg-warning/10 text-warning",
  REFUNDED: "bg-muted text-foreground",
  WRITTEN_OFF: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
  WRITTEN_OFF: "Written Off",
};

interface StatusBadgeProps {
  status: string;
  labels?: Record<string, string>;
}

export function StatusBadge({ status, labels }: StatusBadgeProps) {
  const displayLabels = labels ?? STATUS_LABELS;
  return (
    <Badge
      variant="outline"
      className={cn("border-0 font-medium", STATUS_STYLES[status] ?? "")}
    >
      {displayLabels[status] ?? status}
    </Badge>
  );
}
