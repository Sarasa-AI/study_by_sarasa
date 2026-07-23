"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { StudyNotesType } from "@/lib/export-service";

type CategoryOption = {
  id: string;
  name: string;
};

type NotesFiltersProps = {
  categories: CategoryOption[];
  initialCategoryId?: string;
  initialType: StudyNotesType;
};

const TYPE_OPTIONS: { value: StudyNotesType; label: string }[] = [
  { value: "high_yield", label: "نکات High-Yield کیس‌ها" },
  { value: "mistakes_only", label: "خلاصه سوالات اشتباه من" },
  { value: "all", label: "همه" },
];

function buildNotesHref(type: StudyNotesType, categoryId?: string) {
  const params = new URLSearchParams();
  params.set("type", type);
  if (categoryId) params.set("categoryId", categoryId);
  return `/notes?${params.toString()}`;
}

export function NotesFilters({
  categories,
  initialCategoryId,
  initialType,
}: NotesFiltersProps) {
  const router = useRouter();

  function navigate(nextType: StudyNotesType, nextCategoryId?: string) {
    router.push(buildNotesHref(nextType, nextCategoryId || undefined));
  }

  return (
    <div className="print:hidden flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">دسته</span>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={initialCategoryId ?? ""}
          onChange={(event) => navigate(initialType, event.target.value || undefined)}
          aria-label="فیلتر دسته"
        >
          <option value="">همه دسته‌ها</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">موضوع</span>
        <select
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          value={initialType}
          onChange={(event) =>
            navigate(event.target.value as StudyNotesType, initialCategoryId)
          }
          aria-label="نوع خلاصه"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => window.print()}
      >
        دانلود PDF / پرینت
      </Button>
    </div>
  );
}
