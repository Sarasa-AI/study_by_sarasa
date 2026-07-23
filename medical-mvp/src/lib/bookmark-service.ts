import { prisma } from "@/lib/prisma";

export type BookmarkListItem = {
  caseId: string;
  title: string;
  chiefComplaint: string;
  categoryName: string;
  bookmarkedAt: Date;
  noteContent: string | null;
};

export type CaseBookmarkAndNote = {
  bookmarked: boolean;
  noteContent: string | null;
};

export async function toggleBookmark(
  userId: string,
  caseId: string,
): Promise<{ bookmarked: boolean }> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!kase) {
    throw new Error("CASE_NOT_FOUND");
  }

  const existing = await prisma.userBookmark.findUnique({
    where: { userId_caseId: { userId, caseId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.userBookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }

  await prisma.userBookmark.create({
    data: { userId, caseId },
  });
  return { bookmarked: true };
}

export async function saveUserNote(
  userId: string,
  caseId: string,
  content: string,
): Promise<void> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!kase) {
    throw new Error("CASE_NOT_FOUND");
  }

  const trimmed = content.trim();

  if (!trimmed) {
    await prisma.userNote.deleteMany({
      where: { userId, caseId },
    });
    return;
  }

  await prisma.userNote.upsert({
    where: { userId_caseId: { userId, caseId } },
    create: { userId, caseId, content: trimmed },
    update: { content: trimmed },
  });
}

export async function getUserBookmarksAndNotes(
  userId: string,
): Promise<BookmarkListItem[]> {
  const bookmarks = await prisma.userBookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          chiefComplaint: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  if (bookmarks.length === 0) {
    return [];
  }

  const caseIds = bookmarks.map((b) => b.caseId);
  const notes = await prisma.userNote.findMany({
    where: { userId, caseId: { in: caseIds } },
    select: { caseId: true, content: true },
  });
  const noteByCaseId = new Map(notes.map((n) => [n.caseId, n.content]));

  return bookmarks.map((bookmark) => ({
    caseId: bookmark.case.id,
    title: bookmark.case.title,
    chiefComplaint: bookmark.case.chiefComplaint,
    categoryName: bookmark.case.category.name,
    bookmarkedAt: bookmark.createdAt,
    noteContent: noteByCaseId.get(bookmark.caseId) ?? null,
  }));
}

export async function getCaseBookmarkAndNote(
  userId: string,
  caseId: string,
): Promise<CaseBookmarkAndNote> {
  const [bookmark, note] = await Promise.all([
    prisma.userBookmark.findUnique({
      where: { userId_caseId: { userId, caseId } },
      select: { id: true },
    }),
    prisma.userNote.findUnique({
      where: { userId_caseId: { userId, caseId } },
      select: { content: true },
    }),
  ]);

  return {
    bookmarked: Boolean(bookmark),
    noteContent: note?.content ?? null,
  };
}
