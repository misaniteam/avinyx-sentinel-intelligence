'use client';

import { useDashboardSummary } from '@/lib/api/hooks';
import { StatCard } from '@/components/shared/stat-card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[100px] w-full" />
      ))}
    </div>
  );
}

export default function SummaryWidget() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading || !data) return <SummarySkeleton />;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        title="Total Mentions"
        value={data.total_media_items.toLocaleString()}
        icon={MessageSquare}
      />
      <StatCard
        title="Avg Sentiment"
        value={data.avg_sentiment.toFixed(2)}
        icon={TrendingUp}
      />
      <StatCard
        title="Positive"
        value={data.sentiment_distribution.positive.toLocaleString()}
        icon={ThumbsUp}
      />
      <StatCard
        title="Negative"
        value={data.sentiment_distribution.negative.toLocaleString()}
        icon={ThumbsDown}
      />
    </div>
  );
}
