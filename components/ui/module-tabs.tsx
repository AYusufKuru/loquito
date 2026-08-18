import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ModuleTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface ModuleTabsProps {
  tabs: readonly ModuleTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function ModuleTabs({
  tabs,
  activeId,
  onChange,
  className,
}: ModuleTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-lg border bg-muted/40 p-1",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
