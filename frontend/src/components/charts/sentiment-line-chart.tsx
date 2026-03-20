'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { SentimentTrend } from '@/types';
import { CHART_COLORS, PLATFORM_COLORS, tooltipStyle, axisStyle } from './chart-theme';

interface SentimentLineChartProps {
  data: SentimentTrend[];
  height?: number;
}

export function SentimentLineChart({ data, height = 300 }: SentimentLineChartProps) {
  const platforms = Array.from(
    new Set(data.map((d) => d.platform).filter((p): p is string => p !== null))
  );

  const hasPlatforms = platforms.length > 0;

  // Group data by period_start for the chart
  const periodMap = new Map<string, Record<string, number>>();

  for (const item of data) {
    const key = item.period_start;
    if (!periodMap.has(key)) {
      periodMap.set(key, { period_start_ts: parseISO(key).getTime() });
    }
    const entry = periodMap.get(key)!;
    const lineKey = hasPlatforms ? (item.platform ?? 'overall') : 'overall';
    entry[lineKey] = item.avg_sentiment;
  }

  const chartData = Array.from(periodMap.values()).sort(
    (a, b) => a.period_start_ts - b.period_start_ts
  );

  const lineKeys = hasPlatforms ? platforms : ['overall'];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="period_start_ts"
          tickFormatter={(val: number) => format(new Date(val), 'MMM dd')}
          {...axisStyle}
        />
        <YAxis domain={[-1, 1]} {...axisStyle} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(val: number) => format(new Date(val), 'MMM dd')}
        />
        <Legend />
        {lineKeys.map((key) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={PLATFORM_COLORS[key] ?? CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
