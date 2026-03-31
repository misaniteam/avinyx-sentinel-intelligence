import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './query-keys';
import type { PlatformBreakdown, TopicCount, EngagementPoint, Report, ReportGenerateResponse, ReportDownloadResponse, NegativeAnalysis, AnalyticsInsights } from '@/types';

export function usePlatformBreakdown(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.platformBreakdown(dateFrom, dateTo),
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const query = params.toString();
      return api.get(`api/analytics/platforms/breakdown${query ? `?${query}` : ''}`).json<PlatformBreakdown[]>();
    },
  });
}

export function useTopTopics(limit = 10, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.topTopics(limit, dateFrom, dateTo),
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      return api.get(`api/analytics/topics/top?${params.toString()}`).json<TopicCount[]>();
    },
  });
}

export function useEngagementOverTime(period = 'daily', dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.analytics.engagement(period, dateFrom, dateTo),
    queryFn: () => {
      const params = new URLSearchParams({ period });
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      return api.get(`api/analytics/platforms/engagement-over-time?${params.toString()}`).json<EngagementPoint[]>();
    },
  });
}

// Reports mutations
export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; format?: string; config?: Record<string, unknown> }) =>
      api.post('api/analytics/reports', { json: data }).json<Report>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reportId: string) =>
      api.post(`api/analytics/reports/${reportId}/generate`).json<ReportGenerateResponse>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useReportDownloadUrl() {
  return useMutation({
    mutationFn: (reportId: string) =>
      api.get(`api/analytics/reports/${reportId}/download`).json<ReportDownloadResponse>(),
  });
}

export function useGenerateInsights() {
  return useMutation({
    mutationFn: (params: { date_from?: string; date_to?: string; platforms?: string[]; sentiments?: string[] }) =>
      api.post('api/analytics/dashboard/generate-insights', { json: params, timeout: 300000 }).json<AnalyticsInsights>(),
  });
}

export function useNegativeAnalysis(refresh?: boolean) {
  return useQuery({
    queryKey: queryKeys.dashboard.negativeAnalysis,
    queryFn: () => {
      const params = refresh ? '?refresh=true' : '';
      return api.get(`api/analytics/dashboard/negative-analysis${params}`).json<NegativeAnalysis>();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes to match backend cache
  });
}
