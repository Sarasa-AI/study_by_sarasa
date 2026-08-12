"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryPerformanceItem } from "@/lib/analytics-actions";
import { Button } from "@/components/ui/Button";

type CategoryPerformanceChartProps = {
  data: CategoryPerformanceItem[];
};

const BAR_COLOR = "#0f766e";

export function CategoryPerformanceChart({ data }: CategoryPerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          اولین آزمون خود را بدهید تا عملکرد موضوعی را ببینید!
        </p>
        <Link href="/exams">
          <Button variant="secondary" className="h-8 text-xs">
            شروع آزمون
          </Button>
        </Link>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    accuracyPercent: Math.round(item.accuracy),
    total: item.correct + item.incorrect,
  }));

  return (
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
            return [
              `${value ?? 0}% · ${payload.correct} صحیح / ${payload.incorrect} غلط`,
              "دقت",
            ];
          }}
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #cbd5e1",
            fontSize: "0.875rem",
          }}
        />
        <Bar
          dataKey="accuracyPercent"
          fill={BAR_COLOR}
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
