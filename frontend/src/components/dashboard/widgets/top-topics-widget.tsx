'use client';

import { useTopTopics } from '@/lib/api/hooks-analytics';
import { TopTopicsBarChart } from '@/components/charts/top-topics-bar-chart';
import { Skeleton } from '@/components/ui/skeleton';

export default function TopTopicsWidget() {
  const { data, isLoading } = useTopTopics(10);

  if (isLoading || !data) return <Skeleton className="h-[250px] w-full" />;

  return <TopTopicsBarChart data={data} />;
}
