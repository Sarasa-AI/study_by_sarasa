import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { casePayloadSchema } from "@/lib/case-schema";
import { createCase, listCases, serializeCase } from "@/lib/case-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const cases = await listCases(prisma, instructorId);
  return NextResponse.json(cases.map((kase: Awaited<ReturnType<typeof listCases>>[number]) => serializeCase(kase)));
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const body = await req.json();
  const instructorId = body.instructorId || (session?.user as { id?: string } | undefined)?.id;

  try {
    const payload = casePayloadSchema.parse({
      ...body,
      instructorId,
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
