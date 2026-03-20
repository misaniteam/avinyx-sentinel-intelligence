export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  tenant_id: string | null;
  created_at: string;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  target_regions: string[];
  keywords: string[];
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Voter {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_region: string | null;
  demographics: Record<string, unknown>;
  sentiment_score: number | null;
  tags: string[];
  created_at: string;
}

export interface MediaFeedItem {
  id: string;
  platform: string;
  content: string | null;
  author: string | null;
  published_at: string | null;
  url: string | null;
  engagement: Record<string, number>;
  sentiment_score: number | null;
  sentiment_label: string | null;
}

export interface DataSource {
  id: string;
  platform: string;
  name: string;
  config: Record<string, unknown>;
  poll_interval_minutes: number;
  is_active: boolean;
  last_polled_at: string | null;
}

export interface DashboardSummary {
  total_media_items: number;
  avg_sentiment: number;
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface SentimentTrend {
  period_start: string;
  platform: string | null;
  region: string | null;
  avg_sentiment: number;
  total_count: number;
}

export interface PlatformBreakdown {
  platform: string;
  count: number;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface EngagementPoint {
  period_start: string;
  likes: number;
  shares: number;
  comments: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface Report {
  id: string;
  name: string;
  config: Record<string, unknown>;
  format: string;
  status: string;
  generated_file: string | null;
}

export interface ReportGenerateResponse {
  status: string;
}

export interface ReportDownloadResponse {
  download_url: string;
  expires_in: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
  created_by: string;
}

export interface WorkerStatus {
  worker_run_id: string;
  tenant_id: string;
  platform: string;
  status: "running" | "completed" | "failed";
  items_fetched: number;
  started_at: string;
  updated_at: string;
  error?: string;
}

export interface TenantOnboardRequest {
  tenant: {
    name: string;
    slug: string;
    settings?: Record<string, unknown>;
  };
  admin_email: string;
  admin_password: string;
  admin_name: string;
}
