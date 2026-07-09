import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default async function QuizResultPage({ searchParams }: { searchParams: { id?: string } }) {
  const id = searchParams.id;
  if (!id) return <div>شناسه نتیجه یافت نشد</div>;
  const result = await prisma.quizResult.findUnique({
    where: { id },
    include: { case: { select: { title: true } } },
  });
  if (!result) return <div>نتیجه یافت نشد</div>;
  const percent = Math.round((result.score / result.totalQuestions) * 100);
  return (
    <Card>
      <CardHeader>
        <div className="text-lg font-bold">نتیجه آزمون</div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">کیس: {result.case.title}</div>
        <div className="text-sm">نمره: {result.score} از {result.totalQuestions} ({percent}%)</div>
        <div className="mt-3 text-sm text-slate-600">پاسخ‌ها ذخیره شد. به تمرین ادامه دهید.</div>
      </CardContent>
    </Card>
  );
}
