"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PlatformPieChart,
  SentimentLineChart,
  TopTopicsBarChart,
  EngagementAreaChart,
} from "@/components/charts";
import { ExportableContainer } from "@/components/shared/exportable-container";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("analytics");
  const { data: platformData, isLoading: platformLoading } = usePlatformBreakdown();
  const { data: sentimentData, isLoading: sentimentLoading } = useSentimentTrends("daily");
  const { data: topicsData, isLoading: topicsLoading } = useTopTopics();
  const { data: engagementData, isLoading: engagementLoading } = useEngagementOverTime();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <ExportableContainer title={t("analyticsReport")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("platformBreakdown")}</CardTitle>
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
              <CardTitle>{t("sentimentOverTime")}</CardTitle>
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
              <CardTitle>{t("topTopics")}</CardTitle>
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
              <CardTitle>{t("engagementMetrics")}</CardTitle>
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
