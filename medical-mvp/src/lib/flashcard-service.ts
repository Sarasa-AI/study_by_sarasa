import { prisma } from "@/lib/prisma";

export type FlashcardRating = "again" | "hard" | "good" | "easy";

export type DueFlashcard = {
  id: string;
  frontText: string;
  backText: string;
  imageUrl: string | null;
  caption: string | null;
  case: { id: string; title: string } | null;
};

const RATING_QUALITY: Record<FlashcardRating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function computeSm2Update(
  current: { interval: number; easeFactor: number; repetitions: number },
  rating: FlashcardRating,
  now: Date = new Date(),
): {
  interval: number;
  easeFactor: number;
  repetitions: number;
  dueDate: Date;
  lastReviewedAt: Date;
} {
  const q = RATING_QUALITY[rating];
  let { interval, easeFactor, repetitions } = current;

  if (q < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.max(1, Math.round(interval * easeFactor));
    }
  }

  // Standard SM-2 ease update; hard/easy get an extra nudge per plan.
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (rating === "hard") {
    easeFactor -= 0.15;
  } else if (rating === "easy") {
    easeFactor += 0.15;
  }
  easeFactor = Math.max(1.3, easeFactor);

  return {
    interval,
    easeFactor,
    repetitions,
    dueDate: addDays(now, interval),
    lastReviewedAt: now,
  };
}

export async function getDueFlashcards(
  userId: string,
  limit: number = 20,
): Promise<DueFlashcard[]> {
  const now = new Date();

  const cards = await prisma.flashcard.findMany({
    where: {
      OR: [
        { progress: { none: { userId } } },
        { progress: { some: { userId, dueDate: { lte: now } } } },
      ],
    },
    include: {
      case: { select: { id: true, title: true } },
      progress: {
        where: { userId },
        select: { dueDate: true },
        take: 1,
      },
    },
    take: limit * 3,
  });

  const sorted = cards.sort((a, b) => {
    const aDue = a.progress[0]?.dueDate?.getTime() ?? 0;
    const bDue = b.progress[0]?.dueDate?.getTime() ?? 0;
    return aDue - bDue;
  });

  return sorted.slice(0, limit).map((card) => ({
    id: card.id,
    frontText: card.frontText,
    backText: card.backText,
    imageUrl: card.imageUrl,
    caption: card.caption,
    case: card.case,
  }));
}

export async function getDueFlashcardsCount(userId: string): Promise<number> {
  const now = new Date();
  return prisma.flashcard.count({
    where: {
      OR: [
        { progress: { none: { userId } } },
        { progress: { some: { userId, dueDate: { lte: now } } } },
      ],
    },
  });
}

export async function submitCardReview(
  userId: string,
  flashcardId: string,
  rating: FlashcardRating,
) {
  const flashcard = await prisma.flashcard.findUnique({
    where: { id: flashcardId },
    select: { id: true },
  });

  if (!flashcard) {
    throw new Error("FLASHCARD_NOT_FOUND");
  }

  const existing = await prisma.userFlashcardProgress.findUnique({
    where: {
      userId_flashcardId: { userId, flashcardId },
    },
  });

  const now = new Date();
  const next = computeSm2Update(
    {
      interval: existing?.interval ?? 1,
      easeFactor: existing?.easeFactor ?? 2.5,
      repetitions: existing?.repetitions ?? 0,
    },
    rating,
    now,
  );

  return prisma.userFlashcardProgress.upsert({
    where: {
      userId_flashcardId: { userId, flashcardId },
    },
    create: {
      userId,
      flashcardId,
      interval: next.interval,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
      dueDate: next.dueDate,
      lastReviewedAt: next.lastReviewedAt,
    },
    update: {
      interval: next.interval,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
      dueDate: next.dueDate,
      lastReviewedAt: next.lastReviewedAt,
    },
  });
}
