'use client';

import { useDashboardSummary } from '@/lib/api/hooks';
import { SentimentDistributionPie } from '@/components/charts/sentiment-distribution-pie';
import { Skeleton } from '@/components/ui/skeleton';

export default function SentimentDistributionWidget() {
  const { data, isLoading } = useDashboardSummary();

  if (isLoading || !data) return <Skeleton className="h-[250px] w-full" />;

  return (
    <SentimentDistributionPie
      distribution={data.sentiment_distribution}
      height={250}
    />
  );
}
