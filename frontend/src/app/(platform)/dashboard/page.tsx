"use client";

import { useDashboardSummary, useSentimentTrends } from "@/lib/api/hooks";
import { StatCard } from "@/components/shared/stat-card";
import { BarChart3, TrendingUp, MessageSquare, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();

  if (isLoading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /><div className="h-32 bg-muted rounded-lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Mentions"
          value={summary?.total_media_items ?? 0}
          icon={MessageSquare}
        />
        <StatCard
          title="Avg Sentiment"
          value={summary?.avg_sentiment?.toFixed(2) ?? "0.00"}
          icon={TrendingUp}
        />
        <StatCard
          title="Positive"
          value={summary?.sentiment_distribution?.positive ?? 0}
          icon={BarChart3}
        />
        <StatCard
          title="Negative"
          value={summary?.sentiment_distribution?.negative ?? 0}
          icon={AlertTriangle}
        />
      </div>
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Sentiment Trends</h2>
        <p className="text-muted-foreground">Charts will be rendered here with Recharts</p>
      </div>
    </div>
  );
}
