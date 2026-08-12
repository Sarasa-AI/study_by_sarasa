import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ReviewsLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری مدیریت کیس‌ها">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>

      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-24" />
        ))}
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-48 max-w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <Skeleton className="h-3 w-40" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Skeleton className="h-10 w-full sm:w-24" />
                <Skeleton className="h-10 w-full sm:w-24" />
                <Skeleton className="h-10 w-full sm:w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
