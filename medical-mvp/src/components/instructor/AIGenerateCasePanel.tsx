"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateClinicalCaseAction } from "@/app/actions/case-generator";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type Category = {
  id: string;
  name: string;
};

type AIGenerateCasePanelProps = {
  categories: Category[];
};

export function AIGenerateCasePanel({ categories }: AIGenerateCasePanelProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  async function handleGenerate() {
    if (!categoryId) {
      setServerError("لطفاً یک دسته‌بندی انتخاب کنید");
      return;
    }

    setIsGenerating(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const result = await generateClinicalCaseAction(categoryId, topic || undefined, false, true);

      if (!result.success) {
        setServerError(result.message);
        return;
      }

      setSuccessMessage(result.message);
      setTopic("");
      router.refresh();
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <>
      {successMessage ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-teal-700 px-4 py-3 text-sm text-white shadow-lg">
          {successMessage}
        </div>
      ) : null}

      <Card className="md:col-span-2">
        <CardHeader>
          <h2 className="font-semibold">تولید سریع کیس با هوش مصنوعی</h2>
          <p className="text-sm text-slate-600">
            یک کیس بالینی اطفال تولید و به‌صورت پیش‌نویس ذخیره می‌شود.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
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
            <label className="mb-1 block text-sm">موضوع بالینی (اختیاری)</label>
            <Input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={isGenerating}
              placeholder="مثال: بیماری کاواساکی"
            />
          </div>
          <div className="md:col-span-2">
            {serverError ? <p className="mb-3 text-sm text-red-600">{serverError}</p> : null}
            <Button type="button" disabled={isGenerating} onClick={handleGenerate}>
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال تولید...
                </span>
              ) : (
                "تولید و ذخیره پیش‌نویس"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
