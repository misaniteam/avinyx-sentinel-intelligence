"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlatformPieChart,
  SentimentLineChart,
  TopTopicsBarChart,
  EngagementAreaChart,
} from "@/components/charts";
import { ExportableContainer } from "@/components/shared/exportable-container";
import { useSentimentTrends } from "@/lib/api/hooks";
import {
  usePlatformBreakdown,
  useTopTopics,
  useEngagementOverTime,
} from "@/lib/api/hooks-analytics";

function ChartSkeleton() {
  return (
    <div className="h-[300px] animate-pulse rounded bg-muted" />
  );
}

export default function AnalyticsPage() {
  const { data: platformData, isLoading: platformLoading } = usePlatformBreakdown();
  const { data: sentimentData, isLoading: sentimentLoading } = useSentimentTrends("daily");
  const { data: topicsData, isLoading: topicsLoading } = useTopTopics();
  const { data: engagementData, isLoading: engagementLoading } = useEngagementOverTime();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <ExportableContainer title="Analytics Report">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Platform Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {platformLoading ? (
                <ChartSkeleton />
              ) : (
                <PlatformPieChart data={platformData ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentLoading ? (
                <ChartSkeleton />
              ) : (
                <SentimentLineChart data={sentimentData ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top Topics</CardTitle>
            </CardHeader>
            <CardContent>
              {topicsLoading ? (
                <ChartSkeleton />
              ) : (
                <TopTopicsBarChart data={topicsData ?? []} />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {engagementLoading ? (
                <ChartSkeleton />
              ) : (
                <EngagementAreaChart data={engagementData ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </ExportableContainer>
    </div>
  );
}
