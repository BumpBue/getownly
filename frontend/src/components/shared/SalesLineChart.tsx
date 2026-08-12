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
import { formatBaht, formatDate } from "@/lib/format";
import { CHART_AXIS_STYLE, CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import type { DailySalesPoint } from "@/lib/admin/types";
import { adminMessages } from "@/lib/messages/admin";

/**
 * Daily takings, gross against the platform's share.
 *
 * Amounts arrive as fixed-point strings and are parsed to numbers only here,
 * because a chart plots pixels — nothing downstream of this does arithmetic
 * with the result (the same rule `lib/format.ts` follows).
 */
export function SalesLineChart({ points }: { points: DailySalesPoint[] }) {
  const { reports } = adminMessages;

  const data = points.map((point) => ({
    date: point.date,
    // Short labels: a 90-day range cannot fit thirty full dates across an axis.
    label: formatDate(point.date).replace(/ \d{4}$/, ""),
    [reports.legendGross]: Number(point.grossSales),
    [reports.legendPlatform]: Number(point.platformRevenue),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={CHART_AXIS_STYLE}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
            minTickGap={24}
          />
          <YAxis
            tick={CHART_AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={72}
            tickFormatter={(value: number) => formatBaht(String(value))}
          />
          {/* recharts types both callbacks as taking `unknown`-ish values, so
              each one narrows what it was actually given rather than asserting. */}
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value) => formatBaht(String(value ?? 0))}
            labelFormatter={(_label, payload) =>
              formatDate((payload?.[0]?.payload as { date?: string } | undefined)?.date ?? null)
            }
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey={reports.legendGross}
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey={reports.legendPlatform}
            stroke={CHART_COLORS.secondary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
