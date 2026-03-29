"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PlatformBreakdown } from "@/types";
import { getTooltipStyle, PLATFORM_COLORS, PLATFORM_LABELS, tooltipStyle } from "./chart-theme";
import { useTheme } from "next-themes";

interface PlatformPieChartProps {
  data: PlatformBreakdown[];
  height?: number;
}

const RADIAN = Math.PI / 180;

function renderCustomLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function PlatformPieChart({
  data,
  height = 300,
}: PlatformPieChartProps) {
   const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="platform"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={renderCustomLabel}
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                PLATFORM_COLORS[entry.platform as keyof typeof PLATFORM_COLORS] ??
                "#9ca3af"
              }
            />
          ))}
        </Pie>
        <Legend formatter={(value) => PLATFORM_LABELS[value] || value} />

        <Tooltip
          {...getTooltipStyle(isDark)}
          formatter={(value: number, name: string) => [
            value,
            PLATFORM_LABELS[name] || name,
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
