import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const { caseId, lastStep, status } = body as { caseId: string; lastStep?: number; status?: "IN_PROGRESS" | "COMPLETED" };
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });
  const progress = await prisma.userProgress.upsert({
    where: { userId_caseId: { userId, caseId } },
    update: {
      lastStep: lastStep ?? undefined,
      status: status ?? undefined,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
    create: {
      userId,
      caseId,
      lastStep: lastStep ?? 1,
      status: status ?? "IN_PROGRESS",
    },
  });
  return NextResponse.json(progress);
}
