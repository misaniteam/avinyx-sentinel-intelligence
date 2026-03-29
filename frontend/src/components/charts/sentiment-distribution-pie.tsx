"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, getTooltipStyle, } from "./chart-theme";
import { useTheme } from "next-themes";

interface SentimentDistributionPieProps {
  distribution: { positive: number; negative: number; neutral: number };
  height?: number;
}

const SLICE_CONFIG = [
  { key: "positive", label: "Positive", color: CHART_COLORS.positive },
  { key: "negative", label: "Negative", color: CHART_COLORS.negative },
  { key: "neutral", label: "Neutral", color: CHART_COLORS.neutral },
] as const;

function CenterLabel({
  viewBox,
  total,
}: {
  viewBox?: { cx: number; cy: number };
  total: number;
}) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan
        x={cx}
        dy="-0.3em"
        fontSize={20}
        fontWeight="bold"
        fill="hsl(var(--foreground))"
      >
        {total}
      </tspan>
      <tspan
        x={cx}
        dy="1.4em"
        fontSize={12}
        fill="hsl(var(--muted-foreground))"
      >
        Total
      </tspan>
    </text>
  );
}

export function SentimentDistributionPie({
  distribution,
  height = 300,
}: SentimentDistributionPieProps) {
  const chartData = SLICE_CONFIG.map((s) => ({
    name: s.label,
    value: distribution[s.key],
    color: s.color,
  }));
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const total =
    distribution.positive + distribution.negative + distribution.neutral;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="80%"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
          <CenterLabel total={total} />
        </Pie>
        <Tooltip {...getTooltipStyle(isDark)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
