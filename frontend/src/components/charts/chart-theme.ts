export const PLATFORM_LABELS: Record<string, string> = {
  news_api: "News API",
  news_rss: "News RSS",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "Twitter",
  news: "News",
};

// chart-theme.ts
export const getTooltipStyle = (isDark: boolean) => ({
  contentStyle: {
    backgroundColor: isDark ? "#111827" : "#ffffff",
    border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
    borderRadius: "8px",
    boxShadow: isDark
      ? "0 10px 30px rgba(0, 0, 0, 0.35)"
      : "0 10px 30px rgba(15, 23, 42, 0.12)",
    fontSize: "12px",
    padding: "8px 10px",
    color: isDark ? "#f1f1f1" : "#0d0d0d",
  },
  itemStyle: {
    color: isDark ? "#f1f1f1" : "#0d0d0d",
  },
  labelStyle: {
    color: isDark ? "#f1f1f1" : "#0d0d0d",
  },
});

export const CHART_COLORS = {
  primary: "#ec5901",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#a1a1aa",
  platforms: {  
    facebook: "#1877F2",
    instagram: "#E4405F",
    youtube: "#FF0000",
    twitter: "#1DA1F2",
    news: "#6B7280",
  },
} as const;

export const PLATFORM_COLORS: Record<string, string> = {
  news_api: "#8e3501",
  news_rss: "#ec5901",
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  twitter: "#1DA1F2",  
};

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  },
};

export const getAxisStyle = (isDark: boolean) => ({
  tick: {
    fontSize: 12,
    fill: isDark ? "#9ca3af" : "#374151", // 👈 text color
  },
  axisLine: {
    stroke: isDark ? "#374151" : "#e5e7eb", // 👈 border color
  },
});
