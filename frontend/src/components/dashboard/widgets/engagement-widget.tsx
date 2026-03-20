'use client';

import { useEngagementOverTime } from '@/lib/api/hooks-analytics';
import { EngagementAreaChart } from '@/components/charts/engagement-area-chart';
import { Skeleton } from '@/components/ui/skeleton';

export default function EngagementWidget() {
  const { data, isLoading } = useEngagementOverTime();

  if (isLoading || !data) return <Skeleton className="h-[250px] w-full" />;

  return <EngagementAreaChart data={data} height={250} />;
}
