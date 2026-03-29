"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { TopicCount } from "@/types";
import {
  CHART_COLORS,
  tooltipStyle,
  getTooltipStyle,
  getAxisStyle,
} from "./chart-theme";
import { useTheme } from "next-themes";

interface TopTopicsBarChartProps {
  data: TopicCount[];
  height?: number;
  limit?: number;
}

export function TopTopicsBarChart({
  data,
  height = 300,
  limit = 10,
}: TopTopicsBarChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, limit);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical">
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ec5901" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#f49b67" stopOpacity={1} />
          </linearGradient>
        </defs>
        <XAxis type="number" {...getAxisStyle(isDark)} />
        <YAxis type="category" dataKey="topic" width={120} {...getAxisStyle(isDark)} />
        <YAxis
          type="category"
          dataKey="topic"
          width={150}
          tick={({ x, y, payload }) => (
            <g transform={`translate(${x},${y})`}>
              <text
                x={0}
                y={0}
                dy={4}
                textAnchor="end"
                fill="#9ca3af"
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 140,
                }}
              >
                {payload.value}
              </text>
            </g>
          )}
        />
        <Tooltip {...getTooltipStyle(isDark)} />
        <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 4, 4, 0]}>
          <LabelList
            position="center"
            formatter={(value: number) => {
              const total = sorted.reduce((sum, item) => sum + item.count, 0);
              const percent = (value / total) * 100;

              // if (percent < 5) return ""; // hide very small bars
              return `${percent.toFixed(0)}%`;
            }}
            fill="#fff"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
