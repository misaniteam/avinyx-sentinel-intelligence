'use client';

import { usePlatformBreakdown } from '@/lib/api/hooks-analytics';
import { PlatformPieChart } from '@/components/charts/platform-pie-chart';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformBreakdownWidget() {
  const { data, isLoading } = usePlatformBreakdown();

  if (isLoading || !data) return <Skeleton className="h-[250px] w-full" />;

  return <PlatformPieChart data={data} height={250} />;
}
