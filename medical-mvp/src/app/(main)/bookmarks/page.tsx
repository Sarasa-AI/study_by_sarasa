import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseBookmarkButton } from "@/components/case/CaseBookmarkButton";
import { PersonalNoteEditor } from "@/components/case/PersonalNoteEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { getSessionUser } from "@/lib/auth";
import { getUserBookmarksAndNotes } from "@/lib/bookmark-service";

export default async function BookmarksPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const items = await getUserBookmarksAndNotes(sessionUser.id);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">نشان‌شده‌ها و یادداشت‌ها</h1>
        <p className="text-sm text-slate-600">
          کیس‌های نشانه‌گذاری‌شده و یادداشت‌های شخصی مطالعه شما
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-800">هنوز کیسی نشانه‌گذاری نشده است.</p>
              <p className="mt-1 text-sm text-slate-600">
                از صفحه هر کیس می‌توانید آن را نشانه‌گذاری کنید و یادداشت شخصی بنویسید.
              </p>
            </div>
            <Link href="/library">
              <Button className="w-full sm:w-auto">مرور کتابخانه</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.caseId}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                        {item.categoryName}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.bookmarkedAt.toLocaleDateString("fa-IR")}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                    <p className="text-sm text-slate-600">{item.chiefComplaint}</p>
                  </div>
                  <CaseBookmarkButton
                    caseId={item.caseId}
                    initialBookmarked
                    refreshOnToggle
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Link href={`/case/${item.caseId}`}>
                    <Button variant="secondary">مشاهده کیس</Button>
                  </Link>
                  <Link href={`/case/${item.caseId}/quiz`}>
                    <Button>آزمون</Button>
                  </Link>
                </div>
                <PersonalNoteEditor
                  caseId={item.caseId}
                  initialContent={item.noteContent}
                  defaultOpen={Boolean(item.noteContent?.trim())}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
