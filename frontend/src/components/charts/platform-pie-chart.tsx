"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from "recharts";
import type { PlatformBreakdown } from "@/types";
import { getTooltipStyle, PLATFORM_COLORS, PLATFORM_LABELS } from "./chart-theme";
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
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function renderActiveShape(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
}) {
  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={(props.outerRadius ?? 0) + 8}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      fill={props.fill}
    />
  );
}

export function PlatformPieChart({
  data,
  height = 300,
}: PlatformPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
          activeIndex={activeIndex ?? undefined}
          activeShape={renderActiveShape}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          animationDuration={300}
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
