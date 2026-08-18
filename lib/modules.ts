import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

export const MODULE_IDS = [
  "dashboard",
  "recipes",
  "production",
  "orders",
  "stock",
  "reports",
  "ai",
  "hr",
  "settings",
  "finance",
  "shipments",
  "assets",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleConfig {
  id: ModuleId;
  path: string;
  icon: LucideIcon;
  labelKey: string;
  descriptionKey: string;
}

export const MODULE_CONFIG: ModuleConfig[] = [
  {
    id: "dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    labelKey: "nav.dashboard",
    descriptionKey: "modules.dashboard.description",
  },
  {
    id: "orders",
    path: "/orders",
    icon: ClipboardList,
    labelKey: "nav.orders",
    descriptionKey: "modules.orders.description",
  },
  {
    id: "production",
    path: "/production",
    icon: Factory,
    labelKey: "nav.production",
    descriptionKey: "modules.production.description",
  },
  {
    id: "recipes",
    path: "/recipes",
    icon: Package,
    labelKey: "nav.recipes",
    descriptionKey: "modules.recipes.description",
  },
  {
    id: "stock",
    path: "/stock",
    icon: Boxes,
    labelKey: "nav.stock",
    descriptionKey: "modules.stock.description",
  },
  {
    id: "shipments",
    path: "/shipments",
    icon: Truck,
    labelKey: "nav.shipments",
    descriptionKey: "modules.shipments.description",
  },
  {
    id: "reports",
    path: "/reports",
    icon: BarChart3,
    labelKey: "nav.reports",
    descriptionKey: "modules.reports.description",
  },
  {
    id: "finance",
    path: "/finance",
    icon: Wallet,
    labelKey: "nav.finance",
    descriptionKey: "modules.finance.description",
  },
  {
    id: "ai",
    path: "/ai",
    icon: Sparkles,
    labelKey: "nav.ai",
    descriptionKey: "modules.ai.description",
  },
  {
    id: "hr",
    path: "/hr",
    icon: Users,
    labelKey: "nav.hr",
    descriptionKey: "modules.hr.description",
  },
  {
    id: "assets",
    path: "/assets",
    icon: Wrench,
    labelKey: "nav.assets",
    descriptionKey: "modules.assets.description",
  },
  {
    id: "settings",
    path: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    descriptionKey: "modules.settings.description",
  },
];

export function getModuleConfig(id: ModuleId): ModuleConfig | undefined {
  return MODULE_CONFIG.find((m) => m.id === id);
}
