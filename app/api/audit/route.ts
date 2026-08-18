import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { AUDIT_ENTITY_TYPES } from "@/lib/audit/constants";
import { listAuditLogs } from "@/lib/audit/service";
import { serializeAuditLog } from "@/lib/audit/serialize";
import type { ModuleId } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

function moduleForEntity(entityType: string): ModuleId {
  switch (entityType) {
    case "order":
      return "orders";
    case "recipe":
      return "recipes";
    case "price_list":
    case "customer_price":
    case "customer":
      return "orders";
    case "shipment":
      return "shipments";
    case "employee":
      return "hr";
    default:
      return "settings";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;

  const scoped = Boolean(entityType && entityId);
  const auth = scoped
    ? await requireApiPermission(moduleForEntity(entityType!), "view")
    : await requireApiPermission("settings", "view");
  if (auth.error) return auth.error;
  const userId = searchParams.get("userId") ?? undefined;
  const field = searchParams.get("field") ?? undefined;
  const action = searchParams.get("action") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 200));

  if (entityType && !AUDIT_ENTITY_TYPES.includes(entityType as typeof AUDIT_ENTITY_TYPES[number])) {
    return NextResponse.json({ error: "Geçersiz entityType." }, { status: 400 });
  }

  const logs = await listAuditLogs(prisma, {
    entityType,
    entityId,
    userId,
    field,
    action,
    from,
    to,
    limit,
  });

  return NextResponse.json({
    logs: logs.map(serializeAuditLog),
    entityTypes: AUDIT_ENTITY_TYPES,
  });
}
