import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  title: string;
  count: number;
  accentClass?: string;
  children: ReactNode;
  className?: string;
}

export function KanbanColumn({
  title,
  count,
  accentClass = "bg-muted-foreground",
  children,
  className,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col rounded-xl border bg-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", accentClass)}
          aria-hidden
        />
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">
          {title}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
          {count}
        </span>
      </div>
      <div className="flex min-h-28 flex-1 flex-col gap-2 p-2">{children}</div>
    </div>
  );
}
