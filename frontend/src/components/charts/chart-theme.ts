export const CHART_COLORS = {
  primary: 'hsl(221.2 83.2% 53.3%)',
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#a1a1aa',
  platforms: {
    facebook: '#1877F2',
    instagram: '#E4405F',
    youtube: '#FF0000',
    twitter: '#1DA1F2',
    news: '#6B7280',
  },
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  news: '#6B7280',
};

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '12px',
  },
};

export const axisStyle = {
  tick: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' },
  axisLine: { stroke: 'hsl(var(--border))' },
};
