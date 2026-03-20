'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { EngagementPoint } from '@/types';
import { tooltipStyle, axisStyle } from './chart-theme';

interface EngagementAreaChartProps {
  data: EngagementPoint[];
  height?: number;
}

export function EngagementAreaChart({ data, height = 300 }: EngagementAreaChartProps) {
  const sorted = [...data].sort(
    (a, b) => parseISO(a.period_start).getTime() - parseISO(b.period_start).getTime()
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={sorted}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="period_start"
          tickFormatter={(val: string) => format(parseISO(val), 'MMM dd')}
          {...axisStyle}
        />
        <YAxis {...axisStyle} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(val: string) => format(parseISO(val), 'MMM dd')}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="likes"
          stackId="1"
          stroke="#22c55e"
          fill="#22c55e"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="shares"
          stackId="1"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="comments"
          stackId="1"
          stroke="#f59e0b"
          fill="#f59e0b"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
