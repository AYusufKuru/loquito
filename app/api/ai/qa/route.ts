import { NextResponse } from "next/server";

import { askQuestion, listSampleQuestions } from "@/lib/ai/qa/service";
import { requireApiPermission } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  return NextResponse.json({ samples: listSampleQuestions() });
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("ai", "view");
  if (auth.error) return auth.error;

  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const question = body.question?.trim() ?? "";
  const response = await askQuestion(prisma, question);

  return NextResponse.json({ response });
}
