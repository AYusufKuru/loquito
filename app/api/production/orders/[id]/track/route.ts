import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { requireApiPermission } from "@/lib/auth/api-auth";
import {
  advanceProductionStage,
  updateProductionProgress,
  recordLiveScrap,
  recordQualityCheck,
} from "@/lib/production/track";
import { serializeProductionOrder } from "@/lib/production/serialize";
import type { QualityDecision, Shift } from "@/lib/production/stages";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await request.json();

  try {
    if (body.action === "advance_stage") {
      const order = await advanceProductionStage(prisma, id);
      revalidateTag("production");
      return NextResponse.json({ order: serializeProductionOrder(order) });
    }

    const order = await updateProductionProgress(prisma, id, {
      currentKg: body.currentKg != null ? Number(body.currentKg) : undefined,
      stageProgressPercent:
        body.stageProgressPercent != null
          ? Number(body.stageProgressPercent)
          : undefined,
      producedUnits:
        body.producedUnits != null ? Number(body.producedUnits) : undefined,
      shift: body.shift as Shift | undefined,
      operatorName:
        typeof body.operatorName === "string" ? body.operatorName : undefined,
    });

    revalidateTag("production");
    return NextResponse.json({ order: serializeProductionOrder(order) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Güncelleme başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiPermission("production", "edit");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const body = await request.json();

  try {
    if (body.action === "scrap") {
      const order = await recordLiveScrap(
        prisma,
        id,
        Number(body.quantityKg),
        typeof body.reason === "string" ? body.reason : null,
        typeof body.notes === "string" ? body.notes : null,
      );
      revalidateTag("production");
      return NextResponse.json({ order: serializeProductionOrder(order) });
    }

    if (body.action === "quality_check") {
      const order = await recordQualityCheck(prisma, id, {
        stage: String(body.stage ?? ""),
        parameter: typeof body.parameter === "string" ? body.parameter : null,
        targetValue: typeof body.targetValue === "string" ? body.targetValue : null,
        actualValue: typeof body.actualValue === "string" ? body.actualValue : null,
        unit: typeof body.unit === "string" ? body.unit : null,
        compliance: body.compliance as QualityDecision | null,
        correctiveAction:
          typeof body.correctiveAction === "string" ? body.correctiveAction : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        checkedBy: auth.session?.name ?? null,
      });
      revalidateTag("production");
      return NextResponse.json({ order: serializeProductionOrder(order) });
    }

    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kayıt başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
