"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBaht } from "@/lib/format";
import { CHART_AXIS_STYLE, CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import type { InstructorMonthPoint } from "@/lib/admin/types";
import { adminMessages } from "@/lib/messages/admin";

/** Six months of earnings, oldest bar on the left, as time reads. */
export function MonthlyEarningsChart({ points }: { points: InstructorMonthPoint[] }) {
  const { instructorReports } = adminMessages;

  const data = points.map((point) => ({
    label: point.label,
    salesCount: point.salesCount,
    [instructorReports.totalEarnings]: Number(point.earnings),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
          />
          <YAxis
            tick={CHART_AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) => formatBaht(String(value))}
          />
          <Tooltip
            cursor={{ fill: CHART_COLORS.grid, opacity: 0.4 }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => formatBaht(String(value ?? 0))}
          />
          <Bar
            dataKey={instructorReports.totalEarnings}
            fill={CHART_COLORS.primary}
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
