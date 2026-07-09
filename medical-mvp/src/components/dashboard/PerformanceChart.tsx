"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryAccuracy } from "@/lib/analytics-service";
import { TargetedPracticeButton } from "@/components/dashboard/TargetedPracticeButton";
import { Button } from "@/components/ui/Button";

type PerformanceChartProps = {
  data: CategoryAccuracy[];
  weakAreas?: CategoryAccuracy[];
};

const DEFAULT_BAR_COLOR = "#0f766e";
const WEAK_BAR_COLOR = "#d97706";

export function PerformanceChart({ data, weakAreas = [] }: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        هنوز آزمونی ثبت نشده است
      </div>
    );
  }

  const weakAreaIds = new Set(weakAreas.map((area) => area.categoryId));

  const chartData = data.map((item) => ({
    categoryId: item.categoryId,
    name: item.name,
    accuracyPercent: Math.round(item.accuracy * 100),
    attempts: item.attempts,
    isWeak: weakAreaIds.has(item.categoryId),
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const payload = item.payload as (typeof chartData)[number];
              return [`${value ?? 0}% · ${payload.attempts} تلاش`, "دقت"];
            }}
            contentStyle={{
              borderRadius: "0.75rem",
              border: "1px solid #cbd5e1",
              fontSize: "0.875rem",
            }}
          />
          <Bar dataKey="accuracyPercent" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {chartData.map((entry) => (
              <Cell
                key={entry.categoryId}
                fill={entry.isWeak ? WEAK_BAR_COLOR : DEFAULT_BAR_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {weakAreas.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">پیشنهاد برای بهبود</p>
          <div className="flex flex-wrap gap-2">
            {weakAreas.map((area) => (
              <div key={area.categoryId} className="flex flex-wrap items-center gap-2">
                <Link href={`/category/${area.categoryId}`}>
                  <Button variant="secondary" className="h-8 text-xs">
                    مرور کیس‌های {area.name}
                  </Button>
                </Link>
                <TargetedPracticeButton
                  categoryId={area.categoryId}
                  categoryName={area.name}
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
