"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { MODULE_CONFIG, type ModuleId } from "@/lib/modules";

interface NavLabels {
  [key: string]: string;
}

interface SidebarNavProps {
  moduleIds: ModuleId[];
  labels: NavLabels;
  orientation?: "vertical" | "horizontal";
}

export function SidebarNav({ moduleIds, labels, orientation = "vertical" }: SidebarNavProps) {
  const pathname = usePathname();
  const modules = MODULE_CONFIG.filter((m) => moduleIds.includes(m.id));

  if (orientation === "horizontal") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-thin">
        {modules.map((module) => {
          const isActive =
            pathname === module.path ||
            (module.path !== "/dashboard" && pathname.startsWith(module.path));
          const label = labels[module.labelKey] ?? module.id;

          return (
            <Link
              key={module.id}
              href={module.path}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <module.icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {modules.map((module) => {
        const isActive =
          pathname === module.path ||
          (module.path !== "/dashboard" && pathname.startsWith(module.path));
        const label = labels[module.labelKey] ?? module.id;

        return (
          <Link
            key={module.id}
            href={module.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <module.icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
