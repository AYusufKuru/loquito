import { NextResponse } from "next/server";

import { buildAiRecommendations } from "@/lib/ai/recommendations/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const report = await buildAiRecommendations(prisma, {
    limit: Number.isFinite(limit) && limit! > 0 ? limit! : undefined,
  });

  return NextResponse.json({ report });
}
