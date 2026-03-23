import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./query-keys";
import type { DashboardSummary, SentimentTrend, HeatmapPoint, Campaign, Voter, MediaFeedItem, DataSource, Report, Tenant, User, Role, TenantOnboardRequest, IngestedDataResponse, InfrastructureStatus } from "@/types";

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
export function useHeatmapData(filter?: string, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: queryKeys.heatmap.data(filter, dateFrom, dateTo),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter) params.set("sentiment_filter", filter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const qs = params.toString();
      return api.get(`api/analytics/heatmap/data${qs ? `?${qs}` : ""}`).json<HeatmapPoint[]>();
    },
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

// Ingested Data
export function useIngestedData(params?: {
  platform?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  if (params?.skip) searchParams.set("skip", String(params.skip));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.ingestedData.all, params],
    queryFn: () => api.get(`api/ingestion/ingested-data${qs ? `?${qs}` : ""}`).json<IngestedDataResponse>(),
  });
}

// Data Sources
export function useDataSources() {
  return useQuery({
    queryKey: queryKeys.dataSources.all,
    queryFn: () => api.get("api/ingestion/data-sources").json<DataSource[]>(),
  });
}

export function useCreateDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { platform: string; name: string; config: Record<string, unknown>; poll_interval_minutes: number }) =>
      api.post("api/ingestion/data-sources", { json: data }).json<DataSource>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all }),
  });
}

export function useUpdateDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; config?: Record<string, unknown>; poll_interval_minutes?: number; is_active?: boolean }) =>
      api.patch(`api/ingestion/data-sources/${id}`, { json: data }).json<DataSource>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all }),
  });
}

export function useDeleteDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/ingestion/data-sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all }),
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

// Users CRUD
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string; full_name: string; role_ids?: string[] }) =>
      api.post("api/auth/users", { json: data }).json<User>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; full_name?: string; is_active?: boolean; role_ids?: string[] }) =>
      api.patch(`api/auth/users/${id}`, { json: data }).json<User>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/auth/users/${id}`).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

// Roles CRUD
export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; permissions: string[] }) =>
      api.post("api/auth/roles", { json: data }).json<Role>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; permissions?: string[] }) =>
      api.patch(`api/auth/roles/${id}`, { json: data }).json<Role>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/auth/roles/${id}`).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.all }),
  });
}

// Tenants CRUD (super admin)
export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TenantOnboardRequest) =>
      api.post("api/tenants/tenants", { json: data }).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; status?: string; settings?: Record<string, unknown> }) =>
      api.patch(`api/tenants/tenants/${id}`, { json: data }).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/tenants/tenants/${id}`).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all }),
  });
}

// Notifications
export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: (id: string) => api.patch(`api/notifications/notifications/${id}/read`).json(),
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: () => api.post("api/notifications/notifications/mark-all-read").json(),
  });
}

// Infrastructure (super admin)
export function useInfrastructureStatus() {
  return useQuery({
    queryKey: queryKeys.infrastructure.status,
    queryFn: () => api.get("api/infrastructure/status").json<InfrastructureStatus>(),
    refetchInterval: 5_000, // auto-refresh every 5 seconds
  });
}

// Tenant Settings
export function useTenantSettings() {
  return useQuery({
    queryKey: ["settings", "tenant"],
    queryFn: () => api.get("api/auth/tenant-settings").json<{ settings: Record<string, unknown> }>(),
  });
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { settings: Record<string, unknown> }) =>
      api.patch("api/auth/tenant-settings", { json: data }).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}
