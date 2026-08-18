import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accentClass?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accentClass = "bg-primary/10 text-primary",
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              accentClass,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
