import { cn } from "@/lib/utils";
import type { ActionType, IntegrityStatus } from "@/lib/mockData";

const actionColors: Record<ActionType, string> = {
  CREATE: "bg-verified/15 text-verified border-verified/30",
  MODIFY: "bg-warning/15 text-warning border-warning/30",
  DELETE: "bg-tampered/15 text-tampered border-tampered/30",
  MOVE: "bg-info/15 text-info border-info/30",
};

const statusColors: Record<IntegrityStatus, string> = {
  VERIFIED: "bg-verified/15 text-verified border-verified/30",
  TAMPERED: "bg-tampered/15 text-tampered border-tampered/30",
  PENDING: "bg-warning/15 text-warning border-warning/30",
};

const statusIcons: Record<IntegrityStatus, string> = {
  VERIFIED: "✅",
  TAMPERED: "❌",
  PENDING: "⏳",
};

interface StatusBadgeProps {
  type: "action" | "status";
  value: ActionType | IntegrityStatus;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const colors = type === "action" ? actionColors[value as ActionType] : statusColors[value as IntegrityStatus];
  const icon = type === "status" ? statusIcons[value as IntegrityStatus] + " " : "";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", colors, className)}>
      {icon}{value}
    </span>
  );
}
