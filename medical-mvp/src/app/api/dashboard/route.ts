import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const progress = await prisma.userProgress.findMany({
    where: { userId },
    include: { case: { select: { title: true, categoryId: true } } },
    orderBy: { startedAt: "desc" },
  });
  const results = await prisma.quizResult.findMany({
    where: { userId },
    include: { case: { select: { title: true, categoryId: true } } },
    orderBy: { completedAt: "desc" },
  });
  return NextResponse.json({ progress, results });
}
