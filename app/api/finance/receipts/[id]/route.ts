import { NextResponse } from "next/server";

import { requireApiPermission } from "@/lib/auth/api-auth";
import { approveReceipt } from "@/lib/finance/bank-statements";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("finance", "edit");
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = await request.json();
    if (!body.approve) {
      return NextResponse.json({ error: "Onay işlemi gerekli." }, { status: 400 });
    }

    const receipt = await approveReceipt(
      prisma,
      id,
      auth.session.userId,
      {
        paymentId:
          typeof body.paymentId === "string" ? body.paymentId : undefined,
      },
    );

    return NextResponse.json({ receipt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onay başarısız.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
