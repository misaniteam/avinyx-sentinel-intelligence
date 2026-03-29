import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys } from "./query-keys";
import type { DashboardSummary, SentimentTrend, HeatmapPoint, VoterLocationStats, Campaign, Voter, MediaFeedListResponse, DataSource, Report, Tenant, User, Role, TenantOnboardRequest, IngestedDataResponse, InfrastructureStatus, VoterListGroupsResponse, VoterListGroupDetailResponse, VoterListUploadResponse, AllVoterEntriesResponse, TopicKeyword } from "@/types";

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

export function useVoterLocationStats() {
  return useQuery({
    queryKey: queryKeys.heatmap.voterLocationStats,
    queryFn: () =>
      api.get("api/analytics/heatmap/voter-location-stats").json<VoterLocationStats[]>(),
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

// Voter Lists
export function useVoterListGroups(params?: {
  year?: number;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
  refetchInterval?: number | false;
}) {
  const { refetchInterval, ...queryParams } = params || {};
  const searchParams = new URLSearchParams();
  if (queryParams?.year) searchParams.set("year", String(queryParams.year));
  if (queryParams?.status) searchParams.set("status", queryParams.status);
  if (queryParams?.search) searchParams.set("search", queryParams.search);
  if (queryParams?.skip) searchParams.set("skip", String(queryParams.skip));
  if (queryParams?.limit) searchParams.set("limit", String(queryParams.limit));
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.voterLists.all, queryParams],
    queryFn: () => api.get(`api/ingestion/voter-lists${qs ? `?${qs}` : ""}`).json<VoterListGroupsResponse>(),
    refetchInterval: refetchInterval ?? false,
  });
}

export function useVoterListGroupDetail(groupId: string, params?: {
  search?: string;
  gender?: string;
  skip?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.gender) searchParams.set("gender", params.gender);
  if (params?.skip) searchParams.set("skip", String(params.skip));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.voterLists.detail(groupId), params],
    queryFn: () => api.get(`api/ingestion/voter-lists/${groupId}${qs ? `?${qs}` : ""}`).json<VoterListGroupDetailResponse>(),
    enabled: !!groupId,
  });
}

export function useUploadVoterList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = sessionStorage.getItem("sentinel_access_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/ingestion/voter-list-upload`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json() as Promise<VoterListUploadResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.voterLists.all });
    },
  });
}

export function useAllVoterEntries(params?: {
  search?: string;
  gender?: string;
  status?: string;
  section?: string;
  group_id?: string;
  age_min?: number;
  age_max?: number;
  skip?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.gender) searchParams.set("gender", params.gender);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.section) searchParams.set("section", params.section);
  if (params?.group_id) searchParams.set("group_id", params.group_id);
  if (params?.age_min) searchParams.set("age_min", String(params.age_min));
  if (params?.age_max) searchParams.set("age_max", String(params.age_max));
  if (params?.skip) searchParams.set("skip", String(params.skip));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.voterLists.entries, params],
    queryFn: () => api.get(`api/ingestion/voter-lists/entries/all${qs ? `?${qs}` : ""}`).json<AllVoterEntriesResponse>(),
  });
}

export function useDeleteVoterListGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/ingestion/voter-lists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.voterLists.all }),
  });
}

// Media Feeds
export function useMediaFeeds(params?: {
  platform?: string;
  sentiment?: string;
  topic?: string;
  date_from?: string;
  date_to?: string;
  sort_by?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.sentiment) searchParams.set("sentiment", params.sentiment);
  if (params?.topic) searchParams.set("topic", params.topic);
  if (params?.date_from) searchParams.set("date_from", params.date_from);
  if (params?.date_to) searchParams.set("date_to", params.date_to);
  if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params?.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params?.skip) searchParams.set("skip", String(params.skip));
  searchParams.set("limit", String(params?.limit ?? 50));
  return useQuery({
    queryKey: [...queryKeys.mediaFeeds.all, params?.platform, params?.sentiment, params?.topic, params?.date_from, params?.date_to, params?.sort_by, params?.sort_order, params?.skip, params?.limit],
    queryFn: () => api.get(`api/campaigns/media-feeds?${searchParams}`).json<MediaFeedListResponse>(),
  });
}

export function useMediaFeedTopics() {
  return useQuery({
    queryKey: [...queryKeys.mediaFeeds.all, "topics"],
    queryFn: () => api.get("api/campaigns/media-feeds/topics").json<string[]>(),
  });
}

export function useDeleteMediaFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/campaigns/media-feeds/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.mediaFeeds.all }),
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

// File Upload Data Source
export function useUploadFileDataSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const token = sessionStorage.getItem("sentinel_access_token");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/ingestion/file-upload`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataSources.all });
    },
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

// Topic Keywords
export function useTopicKeywords(params?: { is_active?: boolean; category?: string; search?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.is_active !== undefined) searchParams.set("is_active", String(params.is_active));
  if (params?.category) searchParams.set("category", params.category);
  if (params?.search) searchParams.set("search", params.search);
  const qs = searchParams.toString();
  return useQuery({
    queryKey: [...queryKeys.topicKeywords.all, params],
    queryFn: () => api.get(`api/campaigns/topic-keywords${qs ? `?${qs}` : ""}`).json<TopicKeyword[]>(),
  });
}

export function useCreateTopicKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; keywords: string[]; sentiment_direction: string; category?: string | null; is_active?: boolean }) =>
      api.post("api/campaigns/topic-keywords", { json: data }).json<TopicKeyword>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.topicKeywords.all }),
  });
}

export function useUpdateTopicKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; keywords?: string[]; sentiment_direction?: string; category?: string | null; is_active?: boolean }) =>
      api.patch(`api/campaigns/topic-keywords/${id}`, { json: data }).json<TopicKeyword>(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.topicKeywords.all }),
  });
}

export function useDeleteTopicKeyword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`api/campaigns/topic-keywords/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.topicKeywords.all }),
  });
}
