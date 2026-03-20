import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./query-keys";
import type { DashboardSummary, SentimentTrend, HeatmapPoint, Campaign, Voter, MediaFeedItem, DataSource, Report, Tenant, User, Role } from "@/types";

// Dashboard
export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: () => api.get("api/analytics/dashboard/summary").json<DashboardSummary>(),
  });
}

export function useSentimentTrends(period: string = "daily") {
  return useQuery({
    queryKey: queryKeys.dashboard.trends(period),
    queryFn: () => api.get(`api/analytics/dashboard/trends?period=${period}`).json<SentimentTrend[]>(),
  });
}

// Heatmap
export function useHeatmapData(filter?: string) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(filter),
    queryFn: () => api.get(`api/analytics/heatmap/data${filter ? `?sentiment_filter=${filter}` : ""}`).json<HeatmapPoint[]>(),
  });
}

// Campaigns
export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.campaigns.all,
    queryFn: () => api.get("api/campaigns/campaigns").json<Campaign[]>(),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Campaign>) => api.post("api/campaigns/campaigns", { json: data }).json<Campaign>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns.all }),
  });
}

// Voters
export function useVoters(params?: { region?: string; skip?: number; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.region) searchParams.set("region", params.region);
  if (params?.skip) searchParams.set("skip", String(params.skip));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.voters.all, params],
    queryFn: () => api.get(`api/campaigns/voters${qs ? `?${qs}` : ""}`).json<Voter[]>(),
  });
}

export function useCreateVoter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Voter>) => api.post("api/campaigns/voters", { json: data }).json<Voter>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.voters.all }),
  });
}

// Media Feeds
export function useMediaFeeds(platform?: string) {
  return useQuery({
    queryKey: [...queryKeys.mediaFeeds.all, platform],
    queryFn: () => api.get(`api/campaigns/media-feeds${platform ? `?platform=${platform}` : ""}`).json<MediaFeedItem[]>(),
  });
}

// Data Sources
export function useDataSources() {
  return useQuery({
    queryKey: queryKeys.dataSources.all,
    queryFn: () => api.get("api/ingestion/data-sources").json<DataSource[]>(),
  });
}

// Reports
export function useReports() {
  return useQuery({
    queryKey: queryKeys.reports.all,
    queryFn: () => api.get("api/analytics/reports").json<Report[]>(),
  });
}

// Tenants (super admin)
export function useTenants() {
  return useQuery({
    queryKey: queryKeys.tenants.all,
    queryFn: () => api.get("api/tenants/tenants").json<Tenant[]>(),
  });
}

// Users
export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => api.get("api/auth/users").json<User[]>(),
  });
}

// Roles
export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.all,
    queryFn: () => api.get("api/auth/roles").json<Role[]>(),
  });
}
