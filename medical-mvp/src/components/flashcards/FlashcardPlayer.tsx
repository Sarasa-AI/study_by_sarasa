"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitFlashcardReviewAction } from "@/lib/flashcard-actions";
import type { DueFlashcard, FlashcardRating } from "@/lib/flashcard-service";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type Props = {
  initialCards: DueFlashcard[];
};

const RATING_BUTTONS: {
  rating: FlashcardRating;
  label: string;
  className: string;
}[] = [
  {
    rating: "again",
    label: "تکرار مجدد",
    className: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
  },
  {
    rating: "hard",
    label: "سخت",
    className: "bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500",
  },
  {
    rating: "good",
    label: "خوب",
    className: "bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-600",
  },
  {
    rating: "easy",
    label: "آسان",
    className: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600",
  },
];

function CelebrationEmpty() {
  return (
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
  );
}

export function FlashcardPlayer({ initialCards }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const card = cards[index];
  const remaining = cards.length - index;
  const done = !card;

  function advance() {
    setFlipped(false);
    setZoomOpen(false);
    setError(null);
    setIndex((prev) => prev + 1);
  }

  function handleRating(rating: FlashcardRating) {
    if (!card || isPending) return;

    startTransition(async () => {
      const result = await submitFlashcardReviewAction(card.id, rating);
      if (!result.success) {
        setError(result.message);
        return;
      }
      advance();
    });
  }

  if (done) {
    return <CelebrationEmpty />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex w-fit items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
          کارت {(index + 1).toLocaleString("fa-IR")} از {cards.length.toLocaleString("fa-IR")}
        </span>
        <span className="text-sm text-muted-foreground">
          باقی‌مانده: {remaining.toLocaleString("fa-IR")}
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 py-6">
          {card.case ? (
            <p className="text-xs text-muted-foreground">مرتبط با کیس: {card.case.title}</p>
          ) : null}

          <div
            className={`transition-transform duration-300 ${flipped ? "[transform:rotateY(6deg)]" : ""}`}
          >
            <p className="text-lg font-semibold leading-relaxed text-foreground">
              {flipped ? card.backText : card.frontText}
            </p>
          </div>

          {card.imageUrl ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setZoomOpen(true)}
                className="relative block h-56 w-full overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                aria-label="بزرگ‌نمایی تصویر"
              >
                <Image
                  src={card.imageUrl}
                  alt={card.caption ?? "تصویر فلش‌کارت"}
                  fill
                  className="object-contain bg-slate-50"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
              </button>
              {card.caption ? (
                <p className="text-center text-sm text-muted-foreground">{card.caption}</p>
              ) : null}
            </div>
          ) : null}

          {!flipped ? (
            <Button className="w-full sm:w-auto" onClick={() => setFlipped(true)}>
              نمایش پاسخ
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATING_BUTTONS.map((btn) => (
                <Button
                  key={btn.rating}
                  disabled={isPending}
                  className={btn.className}
                  onClick={() => handleRating(btn.rating)}
                >
                  {btn.label}
                </Button>
              ))}
            </div>
          )}

          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        </CardContent>
      </Card>

      {zoomOpen && card.imageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="نمایش بزرگ تصویر"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="relative h-[80vh] w-full max-w-4xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={card.imageUrl}
              alt={card.caption ?? "تصویر فلش‌کارت"}
              fill
              className="object-contain"
              sizes="100vw"
            />
            <Button
              variant="secondary"
              className="absolute left-2 top-2"
              onClick={() => setZoomOpen(false)}
            >
              بستن
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
