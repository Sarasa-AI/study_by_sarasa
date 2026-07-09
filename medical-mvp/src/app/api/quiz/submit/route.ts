import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { scoreAnswers } from "@/lib/quiz";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await req.json();
  const { caseId, answers, timeSpent } = body as { caseId: string; answers: Record<string, string>; timeSpent?: number };
  if (!caseId || !answers) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { questions: { orderBy: { orderIndex: "asc" }, select: { id: true, correctAnswer: true, points: true } } },
  });
  if (!kase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const correctMap: Record<string, { answer: string; points: number }> = {};
  for (const q of kase.questions) {
    correctMap[q.id] = { answer: q.correctAnswer, points: q.points };
  }
  const { score, total } = scoreAnswers(correctMap, answers);

  const result = await prisma.quizResult.create({
    data: {
      userId,
      caseId,
      score,
      totalQuestions: total,
      timeSpent: timeSpent ?? null,
      answers: answers as any,
    },
  });

  await prisma.userProgress.upsert({
    where: { userId_caseId: { userId, caseId } },
    update: { status: "COMPLETED", completedAt: new Date() },
    create: { userId, caseId, status: "COMPLETED", lastStep: 999, completedAt: new Date() },
  });

  return NextResponse.json({ id: result.id, score, total });
}
