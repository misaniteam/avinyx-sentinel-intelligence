'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TopicCount } from '@/types';
import { CHART_COLORS, tooltipStyle, axisStyle } from './chart-theme';

interface TopTopicsBarChartProps {
  data: TopicCount[];
  height?: number;
  limit?: number;
}

export function TopTopicsBarChart({ data, height = 300, limit = 10 }: TopTopicsBarChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, limit);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={sorted} layout="vertical">
        <XAxis type="number" {...axisStyle} />
        <YAxis type="category" dataKey="topic" width={120} {...axisStyle} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
