'use client';

import { useSentimentTrends } from '@/lib/api/hooks';
import { SentimentLineChart } from '@/components/charts/sentiment-line-chart';
import { Skeleton } from '@/components/ui/skeleton';

export default function SentimentTrendWidget() {
  const { data, isLoading } = useSentimentTrends('daily');

  if (isLoading || !data) return <Skeleton className="h-[250px] w-full" />;

  return <SentimentLineChart data={data} height={250} />;
}
