import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
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
