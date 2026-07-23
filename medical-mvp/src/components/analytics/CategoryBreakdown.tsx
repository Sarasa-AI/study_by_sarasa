import type { CategoryBreakdownItem } from "@/lib/analytics-service";
import { cn } from "@/lib/utils";

type CategoryBreakdownProps = {
  categories: CategoryBreakdownItem[];
  needsFocusIds?: Set<string>;
};

export function CategoryBreakdown({
  categories,
  needsFocusIds = new Set(),
}: CategoryBreakdownProps) {
  if (categories.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        هنوز عملکردی بر اساس دسته‌بندی ثبت نشده است
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const percent = Math.round(category.accuracy * 100);
        const isWeak = needsFocusIds.has(category.categoryId);

        return (
          <div key={category.categoryId} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{category.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {category.correctAnswers.toLocaleString("fa-IR")} از{" "}
                {category.totalAnswered.toLocaleString("fa-IR")} · {percent}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  isWeak ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${percent}%` }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`دقت ${category.name}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
