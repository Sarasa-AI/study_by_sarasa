"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { submitCaseReview } from "@/app/actions/peer-review";
import { useTranslation } from "@/components/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

export type PeerReviewQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  orderIndex: number;
};

export type PeerReviewCase = {
  id: string;
  title: string;
  status: "DRAFT" | "IN_REVIEW" | "REJECTED";
  chiefComplaint: string;
  patientInfo: string;
  symptoms: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  teachingPoints: string[];
  reviewNotes: string | null;
  updatedAt: string;
  category: { id: string; name: string };
  instructor: { id: string; name: string };
  questions: PeerReviewQuestion[];
};

type PeerReviewBoardProps = {
  cases: PeerReviewCase[];
};

function statusBadgeClass(status: PeerReviewCase["status"]) {
  switch (status) {
    case "DRAFT":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "IN_REVIEW":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "REJECTED":
      return "bg-red-50 text-red-700 ring-red-200";
  }
}

function formatDate(iso: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PeerReviewBoard({ cases }: PeerReviewBoardProps) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [selected, setSelected] = useState<PeerReviewCase | null>(null);
  const [notes, setNotes] = useState("");
  const [pendingAction, setPendingAction] = useState<"PUBLISHED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = {
    DRAFT: t.peerReview.statusDraft,
    IN_REVIEW: t.peerReview.statusInReview,
    REJECTED: t.peerReview.statusRejected,
  } as const;

  function openCase(item: PeerReviewCase) {
    setSelected(item);
    setNotes(item.reviewNotes ?? "");
    setError(null);
    setPendingAction(null);
  }

  function closeModal() {
    if (pendingAction) return;
    setSelected(null);
    setNotes("");
    setError(null);
  }

  async function handleReview(status: "PUBLISHED" | "REJECTED") {
    if (!selected) return;

    const trimmed = notes.trim();
    if (status === "REJECTED" && !trimmed) {
      setError(t.peerReview.notesRequired);
      return;
    }

    setPendingAction(status);
    setError(null);
    try {
      const result = await submitCaseReview(
        selected.id,
        status,
        trimmed || undefined,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSelected(null);
      setNotes("");
      router.refresh();
    } catch {
      setError(t.peerReview.genericError);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.peerReview.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.peerReview.subtitle}</p>
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-600">
            {t.peerReview.empty}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cases.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-soft-lg"
              onClick={() => openCase(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCase(item);
                }
              }}
            >
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1 text-start">
                    <h2 className="truncate text-lg font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {t.peerReview.author}: {item.instructor.name}
                      <span className="mx-2 text-slate-300">·</span>
                      {t.peerReview.category}: {item.category.name}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                      statusBadgeClass(item.status),
                    )}
                  >
                    {statusLabel[item.status]}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-0">
                <p className="text-xs text-slate-500">
                  {t.peerReview.updatedAt}: {formatDate(item.updatedAt, locale)}
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    openCase(item);
                  }}
                >
                  {t.peerReview.openReview}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="peer-review-title"
          onClick={closeModal}
        >
          <Card
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="shrink-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1 text-start">
                  <h2
                    id="peer-review-title"
                    className="text-lg font-semibold text-slate-900"
                  >
                    {selected.title}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {t.peerReview.author}: {selected.instructor.name}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                    statusBadgeClass(selected.status),
                  )}
                >
                  {statusLabel[selected.status]}
                </span>
              </div>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto">
              <section className="space-y-3">
                <h3 className="border-s-4 border-primary-600 ps-3 text-sm font-semibold text-slate-800">
                  {t.peerReview.scenario}
                </h3>
                <dl className="grid gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-700">
                      {t.peerReview.chiefComplaint}
                    </dt>
                    <dd className="mt-0.5 text-slate-600">{selected.chiefComplaint}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-700">
                      {t.peerReview.patientInfo}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-slate-600">
                      {selected.patientInfo}
                    </dd>
                  </div>
                  {selected.symptoms.length > 0 ? (
                    <div>
                      <dt className="font-medium text-slate-700">
                        {t.peerReview.symptoms}
                      </dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {selected.symptoms.map((symptom) => (
                          <span
                            key={symptom}
                            className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {symptom}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="font-medium text-slate-700">
                      {t.peerReview.diagnosis}
                    </dt>
                    <dd className="mt-0.5 text-slate-600">{selected.diagnosis}</dd>
                  </div>
                  {selected.differentialDiagnosis.length > 0 ? (
                    <div>
                      <dt className="font-medium text-slate-700">
                        {t.peerReview.differentials}
                      </dt>
                      <dd className="mt-0.5 text-slate-600">
                        {selected.differentialDiagnosis.join(" · ")}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="font-medium text-slate-700">
                      {t.peerReview.management}
                    </dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-slate-600">
                      {selected.management}
                    </dd>
                  </div>
                  {selected.teachingPoints.length > 0 ? (
                    <div>
                      <dt className="font-medium text-slate-700">
                        {t.peerReview.teachingPoints}
                      </dt>
                      <dd className="mt-1 list-inside list-disc text-slate-600">
                        <ul className="space-y-1 ps-4">
                          {selected.teachingPoints.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {selected.questions.length > 0 ? (
                <section className="space-y-4">
                  <h3 className="border-s-4 border-primary-600 ps-3 text-sm font-semibold text-slate-800">
                    {t.peerReview.questions}
                  </h3>
                  {selected.questions.map((question, index) => {
                    const options = [
                      { key: "A", text: question.optionA },
                      { key: "B", text: question.optionB },
                      { key: "C", text: question.optionC },
                      { key: "D", text: question.optionD },
                    ] as const;
                    return (
                      <div
                        key={question.id}
                        className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-4"
                      >
                        <p className="text-sm font-medium text-slate-800">
                          {index + 1}. {question.questionText}
                        </p>
                        <ul className="mt-3 space-y-1.5">
                          {options.map((option) => {
                            const isCorrect =
                              question.correctAnswer === option.key ||
                              question.correctAnswer === option.text;
                            return (
                              <li
                                key={option.key}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-sm",
                                  isCorrect
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                    : "border-transparent bg-white text-slate-700",
                                )}
                              >
                                <span className="font-semibold me-2">{option.key}.</span>
                                {option.text}
                                {isCorrect ? (
                                  <span className="ms-2 text-xs font-medium text-emerald-700">
                                    ({t.peerReview.correctAnswer})
                                  </span>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                        {question.explanation ? (
                          <p className="mt-3 text-xs text-slate-600">
                            <span className="font-medium">{t.peerReview.explanation}: </span>
                            {question.explanation}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </section>
              ) : null}

              {selected.reviewNotes ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
                  <p className="font-medium">{t.peerReview.previousNotes}</p>
                  <p className="mt-1 whitespace-pre-wrap">{selected.reviewNotes}</p>
                </div>
              ) : null}

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-700">
                  {t.peerReview.reviewNotes}
                </span>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder={t.peerReview.notesPlaceholder}
                  disabled={pendingAction !== null}
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </CardContent>

            <CardFooter className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pendingAction !== null}
                onClick={closeModal}
              >
                {t.peerReview.close}
              </Button>
              <div className="ms-auto flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  className="bg-red-500/90 hover:bg-red-600"
                  disabled={pendingAction !== null}
                  onClick={() => void handleReview("REJECTED")}
                >
                  {pendingAction === "REJECTED" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.peerReview.rejecting}
                    </>
                  ) : (
                    t.peerReview.reject
                  )}
                </Button>
                <Button
                  type="button"
                  className="bg-gradient-to-l from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 focus-visible:ring-emerald-600"
                  disabled={pendingAction !== null}
                  onClick={() => void handleReview("PUBLISHED")}
                >
                  {pendingAction === "PUBLISHED" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.peerReview.approving}
                    </>
                  ) : (
                    t.peerReview.approve
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
