import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: string;
  label: string;
  status: "complete" | "current" | "upcoming";
}

interface WorkflowStripProps {
  steps: WorkflowStep[];
  className?: string;
  compact?: boolean;
}

export function WorkflowStrip({ steps, className, compact }: WorkflowStripProps) {
  return (
    <ol
      className={cn(
        "flex items-center gap-1 overflow-x-auto",
        compact ? "py-1" : "rounded-lg border bg-muted/30 px-3 py-3",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={step.id} className="flex min-w-0 flex-1 items-center gap-1">
          {index > 0 && (
            <span
              aria-hidden
              className={cn(
                "mx-1 hidden h-px flex-1 sm:block",
                step.status === "upcoming" ? "bg-border" : "bg-primary/40",
              )}
            />
          )}
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step.status === "complete" &&
                  "bg-emerald-500 text-white",
                step.status === "current" &&
                  "bg-primary text-primary-foreground ring-2 ring-primary/25",
                step.status === "upcoming" &&
                  "bg-muted text-muted-foreground",
              )}
            >
              {step.status === "complete" ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium sm:text-sm",
                step.status === "upcoming" && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
