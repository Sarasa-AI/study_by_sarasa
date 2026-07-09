"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateClinicalCaseAction } from "@/app/actions/case-generator";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  answerOptions,
  caseFormSchema,
  type CaseFormValues,
  type CaseStatusValue,
  mediaTypeValues,
  toCaseFormValues,
} from "@/lib/case-schema";
import { createCaseAction, updateCaseAction } from "@/lib/case-service";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type ExistingCase = Parameters<typeof toCaseFormValues>[0] & {
  id?: string;
};

type CaseFormProps = {
  categories: Category[];
  instructorId: string;
  initialCase?: ExistingCase | null;
  submitLabel?: string;
};

export function CaseForm({ categories, instructorId: _instructorId, initialCase, submitLabel = "ذخیره تغییرات" }: CaseFormProps) {
  const router = useRouter();
  const [submittingStatus, setSubmittingStatus] = useState<CaseStatusValue | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const defaultValues = useMemo(() => toCaseFormValues(initialCase ?? null), [initialCase]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions",
  });

  const categoryId = watch("categoryId");
  const isBusy = submittingStatus !== null || isGenerating;

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function handleAiPrefill() {
    if (!categoryId) {
      setServerError("برای پیش‌پر کردن با هوش مصنوعی، ابتدا دسته‌بندی را انتخاب کنید");
      return;
    }

    setIsGenerating(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const result = await generateClinicalCaseAction(categoryId, aiTopic || undefined, false, false);

      if (!result.success || !result.data?.formValues) {
        setServerError(result.message);
        return;
      }

      reset(result.data.formValues);
      setSuccessMessage(result.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function submitForm(values: CaseFormValues, status: CaseStatusValue) {
    setSubmittingStatus(status);
    setServerError(null);

    try {
      const result = initialCase?.id
        ? await updateCaseAction(initialCase.id, values, status)
        : await createCaseAction(values, status);

      if (!result.success) {
        setServerError(result.message);
        return;
      }

      router.push("/instructor/cases");
      router.refresh();
    } finally {
      setSubmittingStatus(null);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      {successMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-teal-700 px-4 py-3 text-sm text-white shadow-lg">
          {successMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">بخش ۱: اطلاعات پایه</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">عنوان</label>
            <Input {...register("title")} placeholder="مثال: درد قفسه سینه با ST Elevation" />
            {errors.title ? <p className="mt-1 text-sm text-red-600">{errors.title.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">دسته‌بندی</label>
            <select
              {...register("categoryId")}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="">انتخاب کنید</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {errors.categoryId ? <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">موضوع بالینی برای هوش مصنوعی (اختیاری)</label>
            <Input
              value={aiTopic}
              onChange={(event) => setAiTopic(event.target.value)}
              disabled={isBusy}
              placeholder="مثال: کتواسیدوز دیابتی"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="button" variant="secondary" disabled={isBusy} onClick={handleAiPrefill}>
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال تولید...
                </span>
              ) : (
                "پیش‌پر کردن با هوش مصنوعی"
              )}
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-sm">شکایت اصلی</label>
            <Input {...register("chiefComplaint")} placeholder="مثال: درد قفسه سینه ۳۰ دقیقه‌ای" />
            {errors.chiefComplaint ? <p className="mt-1 text-sm text-red-600">{errors.chiefComplaint.message}</p> : null}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">اطلاعات بیمار</label>
            <Textarea {...register("patientInfo")} placeholder="سن، جنس، شرح حال مختصر و یافته‌های مهم" />
            {errors.patientInfo ? <p className="mt-1 text-sm text-red-600">{errors.patientInfo.message}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">بخش ۲: رسانه</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm">آدرس رسانه</label>
            <Input {...register("mediaUrl")} placeholder="https://example.com/media.jpg" />
            {errors.mediaUrl ? <p className="mt-1 text-sm text-red-600">{errors.mediaUrl.message}</p> : null}
          </div>
          <div>
            <label className="mb-2 block text-sm">نوع رسانه</label>
            <div className="flex flex-wrap gap-3">
              {mediaTypeValues.map((mediaType) => (
                <label key={mediaType} className="flex items-center gap-2 text-sm">
                  <input type="radio" value={mediaType} {...register("mediaType")} />
                  <span>{mediaType}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">بخش ۳: محتوای بالینی</h2>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <label className="mb-1 block text-sm">علائم</label>
            <Textarea {...register("symptomsText")} placeholder="هر مورد در یک خط" />
            {errors.symptomsText ? <p className="mt-1 text-sm text-red-600">{errors.symptomsText.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">تشخیص</label>
            <Input {...register("diagnosis")} placeholder="تشخیص نهایی" />
            {errors.diagnosis ? <p className="mt-1 text-sm text-red-600">{errors.diagnosis.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">تشخیص‌های افتراقی</label>
            <Textarea {...register("differentialDiagnosisText")} placeholder="هر مورد در یک خط" />
            {errors.differentialDiagnosisText ? (
              <p className="mt-1 text-sm text-red-600">{errors.differentialDiagnosisText.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">مدیریت</label>
            <Textarea {...register("management")} placeholder="شرح مدیریت کیس" />
            {errors.management ? <p className="mt-1 text-sm text-red-600">{errors.management.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm">نکات آموزشی</label>
            <Textarea {...register("teachingPointsText")} placeholder="هر مورد در یک خط" />
            {errors.teachingPointsText ? <p className="mt-1 text-sm text-red-600">{errors.teachingPointsText.message}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">بخش ۴: سوالات</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                questionText: "",
                optionA: "",
                optionB: "",
                optionC: "",
                optionD: "",
                correctAnswer: "A",
                explanation: "",
              })
            }
          >
            افزودن سوال
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium">سوال {index + 1}</h3>
                {fields.length > 1 ? (
                  <Button type="button" variant="danger" onClick={() => remove(index)}>
                    حذف
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm">متن سوال</label>
                  <Textarea {...register(`questions.${index}.questionText`)} />
                  {errors.questions?.[index]?.questionText ? (
                    <p className="mt-1 text-sm text-red-600">{errors.questions[index]?.questionText?.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-sm">گزینه A</label>
                  <Input {...register(`questions.${index}.optionA`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">گزینه B</label>
                  <Input {...register(`questions.${index}.optionB`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">گزینه C</label>
                  <Input {...register(`questions.${index}.optionC`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">گزینه D</label>
                  <Input {...register(`questions.${index}.optionD`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">پاسخ صحیح</label>
                  <select
                    {...register(`questions.${index}.correctAnswer`)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    {answerOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm">توضیح پاسخ</label>
                  <Textarea {...register(`questions.${index}.explanation`)} />
                </div>
              </div>
            </div>
          ))}
          {errors.questions?.message ? <p className="text-sm text-red-600">{errors.questions.message}</p> : null}
        </CardContent>
      </Card>

      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={isBusy}
          onClick={handleSubmit((values) => submitForm(values, "DRAFT"))}
        >
          {submittingStatus === "DRAFT" ? "در حال ذخیره..." : "پیش‌نویس"}
        </Button>
        <Button type="button" disabled={isBusy} onClick={handleSubmit((values) => submitForm(values, "PUBLISHED"))}>
          {submittingStatus === "PUBLISHED" ? "در حال انتشار..." : initialCase?.id ? submitLabel : "انتشار"}
        </Button>
      </div>
    </form>
  );
}
