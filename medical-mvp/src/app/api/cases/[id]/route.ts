import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { casePayloadSchema } from "@/lib/case-schema";
import { deleteCaseById, getCaseById, serializeCase, updateCase } from "@/lib/case-service";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const kase = await getCaseById(prisma, params.id);
  if (!kase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCase(kase));
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const existing = await getCaseById(prisma, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await getServerSession();
  const body = await req.json();
  const instructorId = body.instructorId || (session?.user as { id?: string } | undefined)?.id || existing.instructorId;

  try {
    const payload = casePayloadSchema.parse({
      ...body,
      instructorId,
    });
    const updated = await updateCase(prisma, params.id, payload);
    return NextResponse.json(serializeCase(updated));
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

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const existing = await getCaseById(prisma, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteCaseById(prisma, params.id);
  return NextResponse.json({ success: true });
}
