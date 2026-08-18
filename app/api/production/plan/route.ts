import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  buildScenarioPlan,
  planOrderProduction,
} from "@/lib/production/planning";
import { loadProductionSettings } from "@/lib/production/settings";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const startDateParam = searchParams.get("startDate");
  const startDate = startDateParam ? new Date(`${startDateParam}T12:00:00`) : new Date();

  if (!orderId) {
    return NextResponse.json({ error: "orderId gerekli." }, { status: 400 });
  }

  const plan = await planOrderProduction(prisma, orderId, startDate);
  if (!plan) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ plan });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("production", "view");
  if (auth.error) return auth.error;

  const body = await request.json();
  const boxes = Number(body.boxes);
  const netWeightG = Number(body.netWeightG) || 250;
  const startDateParam = body.startDate as string | undefined;
  const startDate = startDateParam
    ? new Date(`${startDateParam}T12:00:00`)
    : new Date();

  if (!Number.isFinite(boxes) || boxes <= 0) {
    return NextResponse.json({ error: "Geçerli koli adedi girin." }, { status: 400 });
  }

  const settings = await loadProductionSettings(prisma);
  const plan = buildScenarioPlan(boxes, netWeightG, settings, startDate);

  return NextResponse.json({ plan });
}
