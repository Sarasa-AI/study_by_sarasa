import Link from "next/link";
import { redirect } from "next/navigation";
import { ReviewQuizClient } from "@/components/practice/ReviewQuizClient";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { generateReviewQuiz, getPendingMistakesCount } from "@/lib/practice-service";

export default async function PracticeReviewPage() {
  const sessionUser = await getSessionUser();
  const userId = sessionUser?.id;

  if (!userId) {
    redirect("/login");
  }

  const [items, totalPending] = await Promise.all([
    generateReviewQuiz(userId, 10),
    getPendingMistakesCount(userId),
  ]);

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">مرور سؤالات اشتباه</h1>
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-teal-900">
                هیچ سؤال اشتباهی در صف مرور شما وجود ندارد! عملکرد شما عالی بوده است.
              </p>
              <p className="mt-1 text-sm text-teal-800">
                وقتی در آزمون‌ها اشتباه کنید، سؤالات اینجا ظاهر می‌شوند تا دوباره تمرین کنید.
              </p>
            </div>
            <Link href="/dashboard">
              <Button className="w-full sm:w-auto">بازگشت به داشبورد</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionCount = items.length.toLocaleString("fa-IR");
  const totalCount = totalPending.toLocaleString("fa-IR");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">مرور سؤالات اشتباه</h1>
        <span className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800">
          {sessionCount} سؤال از {totalCount}
        </span>
      </div>
      <ReviewQuizClient items={items} />
    </div>
  );
}
