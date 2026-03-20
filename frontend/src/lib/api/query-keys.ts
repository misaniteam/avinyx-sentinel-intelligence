export const queryKeys = {
  auth: {
    setupStatus: ["auth", "setup-status"] as const,
    me: ["auth", "me"] as const,
  },
  tenants: {
    all: ["tenants"] as const,
    detail: (id: string) => ["tenants", id] as const,
  },
  users: {
    all: ["users"] as const,
    detail: (id: string) => ["users", id] as const,
  },
  roles: {
    all: ["roles"] as const,
  },
  campaigns: {
    all: ["campaigns"] as const,
    detail: (id: string) => ["campaigns", id] as const,
  },
  voters: {
    all: ["voters"] as const,
    detail: (id: string) => ["voters", id] as const,
    interactions: (voterId: string) => ["voters", voterId, "interactions"] as const,
  },
  mediaFeeds: {
    all: ["media-feeds"] as const,
  },
  dashboard: {
    summary: ["dashboard", "summary"] as const,
    trends: (period: string) => ["dashboard", "trends", period] as const,
  },
  heatmap: {
    data: (filter?: string, dateFrom?: string, dateTo?: string) => ["heatmap", filter, dateFrom, dateTo] as const,
  },
  dataSources: {
    all: ["data-sources"] as const,
    detail: (id: string) => ["data-sources", id] as const,
  },
  reports: {
    all: ["reports"] as const,
    detail: (id: string) => ["reports", id] as const,
  },
  analytics: {
    platformBreakdown: (dateFrom?: string, dateTo?: string) => ['analytics', 'platform-breakdown', dateFrom, dateTo] as const,
    topTopics: (limit?: number, dateFrom?: string, dateTo?: string) => ['analytics', 'top-topics', limit, dateFrom, dateTo] as const,
    engagement: (period?: string, dateFrom?: string, dateTo?: string) => ['analytics', 'engagement', period, dateFrom, dateTo] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  settings: {
    tenant: (tenantId: string) => ["settings", tenantId] as const,
  },
};
