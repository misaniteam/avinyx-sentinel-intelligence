"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PlatformPieChart,
  SentimentLineChart,
  TopTopicsBarChart,
  EngagementAreaChart,
  SentimentDistributionPie,
} from "@/components/charts";
import { ExportableContainer } from "@/components/shared/exportable-container";
import { useTranslations } from "next-intl";
import { useSentimentTrends, useDashboardSummary } from "@/lib/api/hooks";
import {
  usePlatformBreakdown,
  useTopTopics,
  useEngagementOverTime,
  useGenerateInsights,
} from "@/lib/api/hooks-analytics";
import { platformConfig } from "@/lib/constants/platforms";
import {
  Filter,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Hash,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
  AlertCircle,
  ChevronDown,
  X,
} from "lucide-react";
import type { AnalyticsInsights } from "@/types";

// --- Date Presets ---
function getDatePreset(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const daysAgo = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };
  switch (preset) {
    case "7d":
      return { from: daysAgo(7), to };
    case "30d":
      return { from: daysAgo(30), to };
    case "90d":
      return { from: daysAgo(90), to };
    default:
      return { from: "", to: "" };
  }
}

const PLATFORM_KEYS = Object.keys(platformConfig);
const SENTIMENT_OPTIONS = ["positive", "negative", "neutral"] as const;
const PERIOD_OPTIONS = ["hourly", "daily", "weekly"] as const;

// --- Animated Stat Card ---
function StatCard({
  label,
  value,
  icon,
  color,
  delay = 0,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}) {
  return (
    <Card
      className="overflow-hidden transition-all duration-500 hover:shadow-lg hover:-translate-y-0.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`rounded-xl p-2.5 ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Multi-Select Filter Popover ---
function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  renderOption?: (key: string) => React.ReactNode;
}) {
  const t = useTranslations("analytics");
  const allSelected = selected.length === options.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-9">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => onChange(allSelected ? [] : [...options])}
          >
            {allSelected ? t("deselectAll") : t("selectAll")}
          </button>
        </div>
        <div className="space-y-1.5">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2.5 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt)
                  );
                }}
              />
              <span className="text-sm">
                {renderOption ? renderOption(opt) : opt}
              </span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// --- Severity Icon ---
function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <AlertCircle className="h-4 w-4 text-amber-500" />;
    case "positive":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/30";
    case "warning":
      return "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/30";
    case "positive":
      return "border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/30";
    default:
      return "border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30";
  }
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    case "medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    default:
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  }
}

// --- Insights Panel ---
function InsightsPanel({ data }: { data: AnalyticsInsights }) {
  const t = useTranslations("analytics");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Executive Summary */}
      {data.summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold mb-1">{t("executiveSummary")}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("analyzedItems", { count: data.analyzed_count })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Key Findings */}
        {data.key_points.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t("keyFindings")}
            </h3>
            <div className="space-y-2.5">
              {data.key_points.map((point, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3.5 transition-all duration-300 hover:shadow-md ${severityColor(point.severity)}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start gap-2.5">
                    <SeverityIcon severity={point.severity} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{point.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("recommendations")}
            </h3>
            <div className="space-y-2.5">
              {data.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3.5 transition-all duration-300 hover:shadow-md bg-card"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm flex-1">{rec.action}</p>
                    <span
                      className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityBadge(rec.priority)}`}
                    >
                      {t(`priority.${rec.priority}` as "priority.high")}
                    </span>
                  </div>
                  {rec.rationale && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {rec.rationale}
                    </p>
                  )}
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {rec.category.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Chart Skeleton ---
function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse rounded-lg bg-muted" />;
}

// --- Main Analytics Page ---
export default function AnalyticsPage() {
  const t = useTranslations("analytics");

  // Filter state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [period, setPeriod] = useState("daily");
  const [topicLimit, setTopicLimit] = useState(10);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);

  // Computed date range
  const effectiveDates = useMemo(() => {
    if (datePreset === "custom") return { from: dateFrom, to: dateTo };
    if (datePreset === "all") return { from: "", to: "" };
    return getDatePreset(datePreset);
  }, [datePreset, dateFrom, dateTo]);

  const apiDateFrom = effectiveDates.from || undefined;
  const apiDateTo = effectiveDates.to || undefined;

  // Data hooks - all respect date filters
  const { data: summaryData } = useDashboardSummary();
  const { data: platformData, isLoading: platformLoading } = usePlatformBreakdown(apiDateFrom, apiDateTo);
  const { data: sentimentData, isLoading: sentimentLoading } = useSentimentTrends(period, apiDateFrom, apiDateTo);
  const { data: topicsData, isLoading: topicsLoading } = useTopTopics(topicLimit, apiDateFrom, apiDateTo);
  const { data: engagementData, isLoading: engagementLoading } = useEngagementOverTime(period, apiDateFrom, apiDateTo);
  const generateInsights = useGenerateInsights();

  // Client-side platform/sentiment filtering for charts that don't support it on backend
  const filteredPlatformData = useMemo(() => {
    if (!platformData) return [];
    if (selectedPlatforms.length === 0) return platformData;
    return platformData.filter((d) => selectedPlatforms.includes(d.platform));
  }, [platformData, selectedPlatforms]);

  const filteredSentimentData = useMemo(() => {
    if (!sentimentData) return [];
    if (selectedPlatforms.length === 0) return sentimentData;
    return sentimentData.filter(
      (d) => !d.platform || selectedPlatforms.includes(d.platform)
    );
  }, [sentimentData, selectedPlatforms]);

  // Compute stats
  const totalItems = filteredPlatformData.reduce((s, d) => s + d.count, 0);
  const dist = summaryData?.sentiment_distribution;
  const distTotal = dist ? dist.positive + dist.negative + dist.neutral : 0;
  const posRate = distTotal > 0 ? ((dist!.positive / distTotal) * 100).toFixed(1) : "0";
  const negRate = distTotal > 0 ? ((dist!.negative / distTotal) * 100).toFixed(1) : "0";

  // Active filter count
  const activeFilterCount =
    (selectedPlatforms.length > 0 ? 1 : 0) +
    (selectedSentiments.length > 0 ? 1 : 0) +
    (datePreset !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedPlatforms([]);
    setSelectedSentiments([]);
    setDatePreset("all");
    setDateFrom("");
    setDateTo("");
    setPeriod("daily");
    setTopicLimit(10);
    setInsights(null);
  };

  const handleGenerateInsights = async () => {
    try {
      const result = await generateInsights.mutateAsync({
        date_from: apiDateFrom,
        date_to: apiDateTo,
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        sentiments: selectedSentiments.length > 0 ? selectedSentiments : undefined,
      });
      setInsights(result);
    } catch {
      setInsights(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <Button
          onClick={handleGenerateInsights}
          disabled={generateInsights.isPending}
          className="gap-2 transition-all duration-300 hover:shadow-lg"
        >
          {generateInsights.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("generating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t("generateInsights")}
            </>
          )}
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            {/* Platform Multi-Select */}
            <MultiSelectFilter
              label={t("platforms")}
              options={PLATFORM_KEYS}
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
              renderOption={(key) => platformConfig[key]?.label || key}
            />

            {/* Sentiment Multi-Select */}
            <MultiSelectFilter
              label={t("sentiment")}
              options={[...SENTIMENT_OPTIONS]}
              selected={selectedSentiments}
              onChange={setSelectedSentiments}
              renderOption={(key) => t(key as "positive")}
            />

            {/* Date Range Preset */}
            <Select
              value={datePreset}
              onValueChange={(v) => {
                setDatePreset(v);
                if (v !== "custom") {
                  setDateFrom("");
                  setDateTo("");
                }
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <Calendar className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTime")}</SelectItem>
                <SelectItem value="7d">{t("last7Days")}</SelectItem>
                <SelectItem value="30d">{t("last30Days")}</SelectItem>
                <SelectItem value="90d">{t("last90Days")}</SelectItem>
                <SelectItem value="custom">{t("custom")}</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Date Inputs */}
            {datePreset === "custom" && (
              <>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("from")}</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">{t("to")}</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-[140px]"
                  />
                </div>
              </>
            )}

            {/* Period */}
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{t(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Topic Limit */}
            <Select value={String(topicLimit)} onValueChange={(v) => setTopicLimit(Number(v))}>
              <SelectTrigger className="w-[100px] h-9">
                <Hash className="h-3.5 w-3.5 mr-1 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 25].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Top {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear button */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 h-9">
                <X className="h-3.5 w-3.5" />
                {t("clearFilters")}
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">
                  {activeFilterCount}
                </Badge>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("totalItems")}
          value={totalItems.toLocaleString()}
          icon={<BarChart3 className="h-5 w-5 text-primary" />}
          color="bg-primary/10"
          delay={0}
        />
        <StatCard
          label={t("avgSentiment")}
          value={summaryData ? summaryData.avg_sentiment.toFixed(3) : "—"}
          icon={
            (summaryData?.avg_sentiment ?? 0) >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )
          }
          color={(summaryData?.avg_sentiment ?? 0) >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}
          delay={100}
        />
        <StatCard
          label={t("positiveRate")}
          value={`${posRate}%`}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          color="bg-green-100 dark:bg-green-900/30"
          delay={200}
        />
        <StatCard
          label={t("negativeRate")}
          value={`${negRate}%`}
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          color="bg-red-100 dark:bg-red-900/30"
          delay={300}
        />
      </div>

      {/* Charts */}
      <ExportableContainer title={t("analyticsReport")}>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Platform Breakdown */}
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("platformBreakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              {platformLoading ? (
                <ChartSkeleton />
              ) : (
                <PlatformPieChart data={filteredPlatformData} />
              )}
            </CardContent>
          </Card>

          {/* Sentiment Over Time */}
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("sentimentOverTime")}</CardTitle>
            </CardHeader>
            <CardContent>
              {sentimentLoading ? (
                <ChartSkeleton />
              ) : (
                <SentimentLineChart data={filteredSentimentData} />
              )}
            </CardContent>
          </Card>

          {/* Top Topics */}
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("topTopics")}</CardTitle>
            </CardHeader>
            <CardContent>
              {topicsLoading ? (
                <ChartSkeleton />
              ) : (
                <TopTopicsBarChart data={topicsData ?? []} limit={topicLimit} />
              )}
            </CardContent>
          </Card>

          {/* Engagement Metrics */}
          <Card className="transition-all duration-300 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">{t("engagementMetrics")}</CardTitle>
            </CardHeader>
            <CardContent>
              {engagementLoading ? (
                <ChartSkeleton />
              ) : (
                <EngagementAreaChart data={engagementData ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Sentiment Distribution */}
          {dist && distTotal > 0 && (
            <Card className="md:col-span-2 transition-all duration-300 hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{t("sentimentDistribution")}</CardTitle>
              </CardHeader>
              <CardContent>
                <SentimentDistributionPie distribution={dist} height={280} />
              </CardContent>
            </Card>
          )}
        </div>
      </ExportableContainer>

      {/* AI Insights Section */}
      {generateInsights.isPending && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("generating")}</p>
          </CardContent>
        </Card>
      )}

      {insights && !generateInsights.isPending && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
              {t("insightsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <InsightsPanel data={insights} />
          </CardContent>
        </Card>
      )}

      {!insights && !generateInsights.isPending && (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t("noDataForInsights")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
