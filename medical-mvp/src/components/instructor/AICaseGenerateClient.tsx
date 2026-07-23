"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CaseForm } from "@/components/instructor/CaseForm";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import {
  generateAICaseAction,
  type GenerateAICaseActionInput,
} from "@/lib/instructor-actions";
import type { CaseDifficulty } from "@/lib/ai-case-generator";
import type { CaseFormValues } from "@/lib/case-schema";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type AICaseGenerateClientProps = {
  categories: Category[];
  instructorId: string;
};

const DIFFICULTY_OPTIONS: { value: "" | CaseDifficulty; label: string }[] = [
  { value: "", label: "پیش‌فرض" },
  { value: "EASY", label: "آسان" },
  { value: "MEDIUM", label: "متوسط" },
  { value: "HARD", label: "سخت" },
];

export function AICaseGenerateClient({ categories, instructorId }: AICaseGenerateClientProps) {
  const [topic, setTopic] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [questionCount, setQuestionCount] = useState(2);
  const [difficulty, setDifficulty] = useState<"" | CaseDifficulty>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<CaseFormValues | null>(null);
  const [draftKey, setDraftKey] = useState(0);

  async function handleGenerate() {
    if (!topic.trim()) {
      setServerError("موضوع یا سناریوی بالینی را وارد کنید");
      return;
    }
    if (!categoryId) {
      setServerError("لطفاً یک دسته‌بندی انتخاب کنید");
      return;
    }

    setIsGenerating(true);
    setServerError(null);

    const input: GenerateAICaseActionInput = {
      topic: topic.trim(),
      categoryId,
      questionCount,
      ...(difficulty ? { difficulty } : {}),
    };

    try {
      const result = await generateAICaseAction(input);
      if (!result.success || !result.data?.formValues) {
        setServerError(result.message);
        return;
      }

      setDraftValues(result.data.formValues);
      setDraftKey((key) => key + 1);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="font-semibold">تولید هوشمند کیس بالینی</h2>
          <p className="text-sm text-slate-600">
            موضوع را وارد کنید تا پیش‌نویس کامل کیس (همراه با MCQ و نکات آموزشی) تولید شود؛ سپس آن را ویرایش و ذخیره کنید.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm">موضوع / سناریوی بالینی</label>
            <Textarea
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={isGenerating}
              placeholder="مثال: آپاندیسیت حاد در زن باردار"
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm">دسته‌بندی</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={isGenerating}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
            >
              <option value="">انتخاب کنید</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">تعداد سوالات</label>
            <select
              value={questionCount}
              onChange={(event) => setQuestionCount(Number(event.target.value))}
              disabled={isGenerating}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
            >
              {[1, 2, 3].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm">سطح دشواری (اختیاری)</label>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as "" | CaseDifficulty)}
              disabled={isGenerating}
              className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50"
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value || "default"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            {serverError ? <p className="mb-3 text-sm text-red-600">{serverError}</p> : null}
            <Button type="button" disabled={isGenerating} onClick={handleGenerate}>
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال تولید پیش‌نویس...
                </span>
              ) : (
                "تولید پیش‌نویس کیس با AI"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {draftValues ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">پیش‌نمایش و ویرایش پیش‌نویس</h2>
            <p className="text-sm text-slate-600">
              محتوا را بررسی و در صورت نیاز ویرایش کنید، سپس به‌صورت پیش‌نویس یا منتشرشده ذخیره کنید.
            </p>
          </div>
          <CaseForm
            key={draftKey}
            categories={categories}
            instructorId={instructorId}
            initialValues={draftValues}
            submitLabel="ذخیره و انتشار کیس"
            redirectTo="/instructor"
            showAiPrefill={false}
          />
        </div>
      ) : null}
    </div>
  );
}
