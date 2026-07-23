import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { casePayloadSchema } from "@/lib/case-schema";
import { createCase, listCases, serializeCase } from "@/lib/case-service";
import { requireInstructorApi } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const cases = await listCases(prisma, instructorId);
  return NextResponse.json(cases.map((kase: Awaited<ReturnType<typeof listCases>>[number]) => serializeCase(kase)));
}

export async function POST(req: Request) {
  const instructor = await requireInstructorApi();
  if (!instructor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const payload = casePayloadSchema.parse({
      ...body,
      instructorId: instructor.id,
    });

    const created = await createCase(prisma, payload);
    return NextResponse.json(serializeCase(created), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "اعتبارسنجی ناموفق بود",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
