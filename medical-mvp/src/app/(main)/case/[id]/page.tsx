import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Link from "next/link";
import { CaseBookmarkButton } from "@/components/case/CaseBookmarkButton";
import { ClinicalImageViewer } from "@/components/case/ClinicalImageViewer";
import { PersonalNoteEditor } from "@/components/case/PersonalNoteEditor";
import { getSessionUser } from "@/lib/auth";
import { getCaseBookmarkAndNote } from "@/lib/bookmark-service";

export default async function CasePage({ params }: { params: { id: string } }) {
  const kase = await prisma.case.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { orderIndex: "asc" } } },
  });
  if (!kase) {
    return <div>کیس یافت نشد</div>;
  }

  const sessionUser = await getSessionUser();
  const bookmarkState = sessionUser?.id
    ? await getCaseBookmarkAndNote(sessionUser.id, kase.id)
    : { bookmarked: false, noteContent: null };

  const patient = JSON.parse(kase.patientInfo || "{}");
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">{kase.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <CaseBookmarkButton
                caseId={kase.id}
                initialBookmarked={bookmarkState.bookmarked}
              />
              <Link href={`/case/${kase.id}/quiz`}>
                <Button>آزمون</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm text-slate-600">مشخصات بیمار</div>
              <div className="text-sm">
                سن: {patient.age} | جنس: {patient.gender} | CC: {kase.chiefComplaint}
              </div>
            </div>
            {kase.mediaUrl && (kase.mediaType === "IMAGE" || !kase.mediaType) ? (
              <ClinicalImageViewer src={kase.mediaUrl} previewClassName="h-64" />
            ) : null}
          </div>
          <div>
            <h3 className="mb-2 font-semibold">علائم</h3>
            <ul className="list-inside list-disc text-sm">
              {kase.symptoms.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">تشخیص افتراقی</h3>
            <ul className="list-inside list-disc text-sm">
              {kase.differentialDiagnosis.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">مدیریت اورژانسی</h3>
            <p className="whitespace-pre-line text-sm">{kase.management}</p>
          </div>
          {kase.teachingPoints.length > 0 ? (
            <div>
              <h3 className="mb-2 font-semibold">نکات آموزشی</h3>
              <ul className="list-inside list-disc text-sm">
                {kase.teachingPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <PersonalNoteEditor
        caseId={kase.id}
        initialContent={bookmarkState.noteContent}
      />
    </div>
  );
}
