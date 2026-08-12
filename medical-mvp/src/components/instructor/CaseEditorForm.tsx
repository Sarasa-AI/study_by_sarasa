"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Edit, Loader2, Save, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ClinicalImageField } from "@/components/instructor/ClinicalImageField";
import {
  answerOptions,
  caseFormSchema,
  type CaseFormValues,
  type CaseStatusValue,
  toCaseFormValues,
} from "@/lib/case-schema";
import {
  updateAndPublishCase,
  type CaseForEdit,
} from "@/lib/instructor-actions";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type CaseEditorFormProps = {
  caseId: string;
  initialCase: CaseForEdit;
  categories: Category[];
};

export function CaseEditorForm({ caseId, initialCase, categories }: CaseEditorFormProps) {
  const router = useRouter();
  const [submittingStatus, setSubmittingStatus] = useState<CaseStatusValue | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues = useMemo(() => toCaseFormValues(initialCase), [initialCase]);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues,
  });

  const mediaUrl = watch("mediaUrl");

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions",
  });

  const isBusy = submittingStatus !== null;

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function submitForm(values: CaseFormValues, status: CaseStatusValue) {
    setSubmittingStatus(status);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const result = await updateAndPublishCase(caseId, values, status);
      if (!result.success) {
        setServerError(result.message);
        return;
      }

      setSuccessMessage(result.message);
      router.push("/instructor/reviews");
      router.refresh();
    } finally {
      setSubmittingStatus(null);
    }
  }

  return (
    <form className="space-y-6 pb-28" onSubmit={(event) => event.preventDefault()}>
      {successMessage ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-teal-700 px-4 py-3 text-sm text-white shadow-lg">
          {successMessage}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
          <Edit className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ویرایش و بررسی کیس</h1>
          <p className="text-sm text-slate-600">محتوای بالینی و سوالات را بازبینی کنید، سپس منتشر نمایید.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">بخش ۱: روایت بالینی</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">عنوان</label>
            <Input {...register("title")} placeholder="عنوان کیس بالینی" />
            {errors.title ? <p className="mt-1 text-sm text-red-600">{errors.title.message}</p> : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">دسته‌بندی</label>
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
            {errors.categoryId ? (
              <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">شکایت اصلی</label>
            <Textarea {...register("chiefComplaint")} placeholder="شرح شکایت اصلی بیمار" rows={2} />
            {errors.chiefComplaint ? (
              <p className="mt-1 text-sm text-red-600">{errors.chiefComplaint.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">اطلاعات بیمار</label>
            <Textarea
              {...register("patientInfo")}
              placeholder="سن، جنس، شرح حال مختصر و یافته‌های مهم"
              rows={4}
            />
            {errors.patientInfo ? (
              <p className="mt-1 text-sm text-red-600">{errors.patientInfo.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">علائم (هر مورد در یک خط)</label>
            <Textarea {...register("symptomsText")} placeholder="هر علامت در یک خط" rows={3} />
            {errors.symptomsText ? (
              <p className="mt-1 text-sm text-red-600">{errors.symptomsText.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">تشخیص</label>
            <Textarea {...register("diagnosis")} placeholder="تشخیص نهایی" rows={2} />
            {errors.diagnosis ? (
              <p className="mt-1 text-sm text-red-600">{errors.diagnosis.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">تشخیص‌های افتراقی (هر مورد در یک خط)</label>
            <Textarea
              {...register("differentialDiagnosisText")}
              placeholder="هر تشخیص افتراقی در یک خط"
              rows={3}
            />
            {errors.differentialDiagnosisText ? (
              <p className="mt-1 text-sm text-red-600">{errors.differentialDiagnosisText.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">مدیریت</label>
            <Textarea {...register("management")} placeholder="شرح مدیریت و درمان" rows={4} />
            {errors.management ? (
              <p className="mt-1 text-sm text-red-600">{errors.management.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">نکات آموزشی (هر مورد در یک خط)</label>
            <Textarea
              {...register("teachingPointsText")}
              placeholder="هر نکته آموزشی در یک خط"
              rows={3}
            />
            {errors.teachingPointsText ? (
              <p className="mt-1 text-sm text-red-600">{errors.teachingPointsText.message}</p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <ClinicalImageField
              value={mediaUrl}
              onChange={(url) => {
                setValue("mediaUrl", url, { shouldDirty: true, shouldValidate: true });
                setValue("mediaType", url ? "IMAGE" : null, { shouldDirty: true });
              }}
              error={errors.mediaUrl?.message}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-slate-900">منابع و گایدلاین‌ها</h2>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-500">
            منابع بازیابی‌شده از پایگاه دانش؛ پیش از انتشار بررسی کنید.
          </p>
          <Textarea
            {...register("referencesText")}
            placeholder="هر منبع یا گایدلاین در یک خط"
            rows={4}
            className="focus-visible:ring-teal-600"
          />
          {errors.referencesText ? (
            <p className="mt-1 text-sm text-red-600">{errors.referencesText.message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-4">
          <h2 className="font-semibold text-slate-900">بخش ۲: سوالات چندگزینه‌ای</h2>
          <Button
            type="button"
            variant="secondary"
            disabled={isBusy}
            onClick={() =>
              append({
                questionText: "",
                optionA: "",
                optionB: "",
                optionC: "",
                optionD: "",
                correctAnswer: "A",
                explanation: "",
                clinicalReasoning: null,
                distractorRationales: null,
              })
            }
          >
            افزودن سوال
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-medium text-slate-800">سوال {index + 1}</h3>
                {fields.length > 1 ? (
                  <Button type="button" variant="danger" disabled={isBusy} onClick={() => remove(index)}>
                    حذف
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">متن سوال (Stem)</label>
                  <Textarea {...register(`questions.${index}.questionText`)} rows={3} />
                  {errors.questions?.[index]?.questionText ? (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.questions[index]?.questionText?.message}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">گزینه A</label>
                  <Input {...register(`questions.${index}.optionA`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">گزینه B</label>
                  <Input {...register(`questions.${index}.optionB`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">گزینه C</label>
                  <Input {...register(`questions.${index}.optionC`)} />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">گزینه D</label>
                  <Input {...register(`questions.${index}.optionD`)} />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-slate-700">پاسخ صحیح</label>
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
                  <label className="mb-1 block text-sm text-slate-700">توضیح پاسخ</label>
                  <Textarea {...register(`questions.${index}.explanation`)} rows={2} />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-slate-700">استدلال بالینی</label>
                  <Textarea {...register(`questions.${index}.clinicalReasoning`)} rows={3} />
                </div>
              </div>
            </div>
          ))}
          {errors.questions?.message ? (
            <p className="text-sm text-red-600">{errors.questions.message}</p>
          ) : null}
        </CardContent>
      </Card>

      {serverError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-slate-500">تغییرات را ذخیره کنید یا برای دانشجویان منتشر نمایید.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={isBusy}
              onClick={handleSubmit((values) => submitForm(values, "REJECTED"))}
            >
              {submittingStatus === "REJECTED" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال رد...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  رد کیس
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              onClick={handleSubmit((values) => submitForm(values, "DRAFT"))}
            >
              {submittingStatus === "DRAFT" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ذخیره...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  ذخیره پیش‌نویس
                </>
              )}
            </Button>
            <Button
              type="button"
              disabled={isBusy}
              onClick={handleSubmit((values) => submitForm(values, "PUBLISHED"))}
            >
              {submittingStatus === "PUBLISHED" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال انتشار...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  انتشار نهایی
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
