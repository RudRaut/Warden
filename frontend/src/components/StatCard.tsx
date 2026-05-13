import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  variant?: "blue" | "green" | "red" | "amber" | "grey";
  className?: string;
}

const variantStyles = {
  blue: "border-l-info bg-info/5",
  green: "border-l-verified bg-verified/5",
  red: "border-l-tampered bg-tampered/5",
  amber: "border-l-warning bg-warning/5",
  grey: "border-l-muted-foreground bg-muted/50",
};

const iconStyles = {
  blue: "text-info",
  green: "text-verified",
  red: "text-tampered",
  amber: "text-warning",
  grey: "text-muted-foreground",
};

export function StatCard({ icon, label, value, variant = "blue", className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-l-4 bg-card p-4 shadow-sm", variantStyles[variant], className)}>
      <div className="flex items-center gap-3">
        <div className={cn("shrink-0", iconStyles[variant])}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}
