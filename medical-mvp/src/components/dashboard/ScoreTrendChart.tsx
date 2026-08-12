"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScoreTrendPoint } from "@/lib/analytics-actions";
import { Button } from "@/components/ui/Button";

type ScoreTrendChartProps = {
  data: ScoreTrendPoint[];
};

const LINE_COLOR = "#0f766e";

function formatDateLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">
          اولین آزمون خود را بدهید تا روند نمرات را ببینید!
        </p>
        <Link href="/exams">
          <Button variant="secondary" className="h-8 text-xs">
            شروع آزمون
          </Button>
        </Link>
      </div>
    );
  }

  const chartData = data.map((point, index) => ({
    ...point,
    label: formatDateLabel(point.completedAt),
    index: index + 1,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          formatter={(value) => [`${value ?? 0}%`, "نمره"]}
          labelFormatter={(_label, payload) => {
            const point = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
            return point?.examTitle ?? "";
          }}
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #cbd5e1",
            fontSize: "0.875rem",
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke={LINE_COLOR}
          strokeWidth={2.5}
          dot={{ r: 4, fill: LINE_COLOR, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
