"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccuracyTrendPoint } from "@/lib/analytics-service";

type AccuracyTrendChartProps = {
  data: AccuracyTrendPoint[];
};

export function AccuracyTrendChart({ data }: AccuracyTrendChartProps) {
  const hasActivity = data.some(
    (point) => point.questionsAnswered > 0 || point.mistakesCreated > 0,
  );

  if (!hasActivity) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        هنوز داده‌ای برای ۳۰ روز اخیر ثبت نشده است
      </div>
    );
  }

  const chartData = data.map((point) => ({
    ...point,
    accuracyPercent:
      point.questionsAnswered > 0 ? Math.round(point.accuracy * 100) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          yAxisId="accuracy"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <YAxis
          yAxisId="mistakes"
          orientation="right"
          hide
          domain={[0, "auto"]}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === "دقت") {
              return [`${value ?? "—"}%`, "دقت"];
            }
            return [value ?? 0, "اشتباهات جدید"];
          }}
          labelFormatter={(label) => `تاریخ: ${label}`}
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #cbd5e1",
            fontSize: "0.875rem",
          }}
        />
        <Legend />
        <Line
          yAxisId="accuracy"
          type="monotone"
          dataKey="accuracyPercent"
          name="دقت"
          stroke="#0f766e"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          yAxisId="mistakes"
          type="monotone"
          dataKey="mistakesCreated"
          name="اشتباهات جدید"
          stroke="#d97706"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
