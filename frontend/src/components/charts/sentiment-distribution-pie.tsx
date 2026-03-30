'use client';

import { useState } from 'react';
import {
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, PLATFORM_LABELS } from './chart-theme';
import { formatSentimentLabel } from '@/lib/formatterLegendLabel';



interface DataItem {
  name: string;
  value: number;
  color: string;
}

interface SentimentDistributionPieProps {
  distribution: Record<string, number>;
  height?: number;
}


const SENTIMENT_COLORS: Record<string, string> = {
  positive: CHART_COLORS.positive,
  negative: CHART_COLORS.negative,
  neutral: CHART_COLORS.neutral,
};

export default function SentimentDistributionPie({
  distribution,
  height = 320,
}: SentimentDistributionPieProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData: DataItem[] = Object.entries(distribution).map(
    ([name, value]) => ({
      name,
      value,
      color: SENTIMENT_COLORS[name.toLowerCase()] ?? CHART_COLORS.primary,
    })
  );

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const maxItem = chartData.reduce((a, b) => (b.value > a.value ? b : a));
  const active = activeIndex !== null ? chartData[activeIndex] : maxItem;
  const pct = Math.round((active.value / total) * 100);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      {/* Center label overlay */}
      <div
        style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.1 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2, maxWidth: 80 }}>
          {active.name}
        </div>
      </div>

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
            onMouseEnter={(_: DataItem, index: number) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {/* <Tooltip
            formatter={(value: number) =>
              `${Math.round((value / total) * 100)}% (${value})`
            }
          /> */}
          <Legend formatter={formatSentimentLabel} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
