import Link from "next/link";
import { redirect } from "next/navigation";
import { FlashcardPlayer } from "@/components/flashcards/FlashcardPlayer";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { getDueFlashcards, getDueFlashcardsCount } from "@/lib/flashcard-service";

export default async function FlashcardsPage() {
  const sessionUser = await getSessionUser();
  const userId = sessionUser?.id;

  if (!userId) {
    redirect("/login");
  }

  const [cards, totalDue] = await Promise.all([
    getDueFlashcards(userId, 20),
    getDueFlashcardsCount(userId),
  ]);

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">فلش‌کارت‌ها</h1>
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-teal-900">
                آفرین! همه فلش‌کارت‌های امروز را مرور کردید.
              </p>
              <p className="mt-1 text-sm text-teal-800">
                فردا کارت‌های جدید بر اساس فاصله‌گذاری زمانی آماده می‌شوند.
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

  const sessionCount = cards.length.toLocaleString("fa-IR");
  const totalCount = totalDue.toLocaleString("fa-IR");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">فلش‌کارت‌ها</h1>
        <span className="inline-flex w-fit items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-800">
          {sessionCount} کارت از {totalCount}
        </span>
      </div>
      <FlashcardPlayer initialCards={cards} />
    </div>
  );
}
