import { redirect } from "next/navigation";
import { NotesFilters } from "@/components/notes/NotesFilters";
import { getSessionUser } from "@/lib/auth";
import {
  getStudyNotesData,
  type StudyNotesCaseItem,
  type StudyNotesMistakeItem,
  type StudyNotesType,
} from "@/lib/export-service";
import { answerOptions } from "@/lib/case-schema";
import { prisma } from "@/lib/prisma";

const TYPE_LABELS: Record<StudyNotesType, string> = {
  high_yield: "نکات High-Yield کیس‌ها",
  mistakes_only: "خلاصه سوالات اشتباه من",
  all: "همه موضوعات",
};

function parseType(value?: string): StudyNotesType {
  if (value === "mistakes_only" || value === "all" || value === "high_yield") {
    return value;
  }
  return "high_yield";
}

function formatCorrectAnswer(
  correctAnswer: string,
  options: Record<(typeof answerOptions)[number], string>,
) {
  const letter = correctAnswer as (typeof answerOptions)[number];
  const text = options[letter];
  return text ? `${letter}) ${text}` : correctAnswer;
}

function CaseBlock({ item }: { item: StudyNotesCaseItem }) {
  return (
    <article className="break-inside-avoid border-b border-slate-300 pb-6 pt-2">
      <h3 className="text-base font-bold text-black">{item.title}</h3>
      <p className="mt-1 text-sm text-slate-800">
        <span className="font-semibold">دسته:</span> {item.categoryName}
      </p>
      <p className="mt-1 text-sm text-slate-800">
        <span className="font-semibold">تشخیص:</span> {item.diagnosis}
      </p>

      {item.teachingPoints.length > 0 && (
        <div className="mt-3">
          <h4 className="text-sm font-semibold text-black">نکات آموزشی (Teaching Points)</h4>
          <ul className="mt-1 list-disc space-y-1 pr-5 text-sm leading-relaxed text-black">
            {item.teachingPoints.map((point, index) => (
              <li key={`${item.id}-tp-${index}`}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {item.questions.length > 0 && (
        <div className="mt-4 space-y-3">
          <h4 className="text-sm font-semibold text-black">سؤالات کلیدی</h4>
          {item.questions.map((question, index) => {
            const reasoning = question.clinicalReasoning?.trim() || question.explanation;
            return (
              <div
                key={question.id}
                className="break-inside-avoid rounded border border-slate-200 p-3"
              >
                <p className="text-sm font-medium text-black">
                  {index + 1}. {question.questionText}
                </p>
                <ul className="mt-2 space-y-0.5 text-sm text-slate-800">
                  {answerOptions.map((letter) => (
                    <li key={letter}>
                      {letter}) {question.options[letter]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-black">
                  <span className="font-semibold">پاسخ صحیح:</span>{" "}
                  {formatCorrectAnswer(question.correctAnswer, question.options)}
                </p>
                {reasoning && (
                  <div className="mt-2 border-r-2 border-slate-400 pr-3 text-sm leading-relaxed text-slate-900">
                    <p className="font-semibold">استدلال بالینی / توضیح:</p>
                    <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function MistakeBlock({
  item,
  index,
}: {
  item: StudyNotesMistakeItem;
  index: number;
}) {
  const reasoning = item.clinicalReasoning?.trim() || item.explanation;

  return (
    <article className="break-inside-avoid border-b border-slate-300 pb-6 pt-2">
      <p className="text-xs text-slate-600">
        {item.categoryName} · {item.caseTitle}
      </p>
      <p className="mt-1 text-sm font-medium text-black">
        {index + 1}. {item.questionText}
      </p>
      <ul className="mt-2 space-y-0.5 text-sm text-slate-800">
        {answerOptions.map((letter) => (
          <li key={letter}>
            {letter}) {item.options[letter]}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-black">
        <span className="font-semibold">پاسخ صحیح:</span>{" "}
        {formatCorrectAnswer(item.correctAnswer, item.options)}
      </p>
      {reasoning && (
        <div className="mt-2 border-r-2 border-slate-400 pr-3 text-sm leading-relaxed text-slate-900">
          <p className="font-semibold">استدلال بالینی:</p>
          <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
        </div>
      )}
    </article>
  );
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: { type?: string; categoryId?: string };
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.id) {
    redirect("/login");
  }

  const type = parseType(searchParams.type);
  const categoryId = searchParams.categoryId || undefined;

  const [categories, notes] = await Promise.all([
    prisma.category.findMany({
      orderBy: { orderIndex: "asc" },
      select: { id: true, name: true },
    }),
    getStudyNotesData(sessionUser.id, { type, categoryId }),
  ]);

  const selectedCategoryName = categoryId
    ? categories.find((c) => c.id === categoryId)?.name
    : undefined;

  const topicLabel = TYPE_LABELS[notes.type];
  const today = new Date().toLocaleDateString("fa-IR");
  const studentName = sessionUser.name?.trim() || "دانشجو";
  const isEmpty = notes.cases.length === 0 && notes.mistakes.length === 0;

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-2">
        <h1 className="text-2xl font-bold">خلاصه و جزوه‌ها</h1>
        <p className="text-sm text-slate-600">
          تولید و چاپ راهنمای مطالعه بر اساس نکات High-Yield یا سؤالات اشتباه شما
        </p>
      </div>

      <NotesFilters
        categories={categories}
        initialCategoryId={categoryId}
        initialType={type}
      />

      {isEmpty ? (
        <div className="print:hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          محتوایی برای نمایش با فیلترهای انتخاب‌شده یافت نشد.
        </div>
      ) : null}

      <div className="study-notes-print text-black">
        <header className="border-b-2 border-black pb-4">
          <h2 className="text-xl font-bold tracking-tight">آموزش بالینی</h2>
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline font-semibold">دانشجو: </dt>
              <dd className="inline">{studentName}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">تاریخ: </dt>
              <dd className="inline">{today}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">موضوع: </dt>
              <dd className="inline">{topicLabel}</dd>
            </div>
            {selectedCategoryName ? (
              <div>
                <dt className="inline font-semibold">دسته: </dt>
                <dd className="inline">{selectedCategoryName}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        {notes.cases.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-3 border-b border-slate-400 pb-1 text-lg font-bold">
              نکات High-Yield کیس‌های بالینی
            </h3>
            <div className="space-y-4">
              {notes.cases.map((item) => (
                <CaseBlock key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}

        {notes.mistakes.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-3 border-b border-slate-400 pb-1 text-lg font-bold">
              خلاصه سؤالات اشتباه
            </h3>
            <div className="space-y-4">
              {notes.mistakes.map((item, index) => (
                <MistakeBlock key={item.mistakeId} item={item} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
