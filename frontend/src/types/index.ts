export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  constituency_code: string | null;
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

export interface CommentSentiment {
  sentiment_score: number;
  sentiment_label: string;
  summary: string;
}

export interface MediaFeedItem {
  id: string;
  platform: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  source_link: string | null;
  external_links: string[];
  author: string | null;
  published_at: string | null;
  engagement: Record<string, unknown> & { comment_sentiment?: CommentSentiment };
  sentiment_score: number | null;
  sentiment_label: string | null;
  priority_score: number | null;
  topics: string[];
  summary: string | null;
}

export interface MediaFeedListResponse {
  items: MediaFeedItem[];
  total: number;
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

export interface NegativePoint {
  theme: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  sources_count: number;
  sample_titles: string[];
}

export interface Actionable {
  action: string;
  priority: 'urgent' | 'high' | 'medium';
  type: string;
  addresses_themes: string[];
}

export interface NegativeAnalysis {
  negative_points: NegativePoint[];
  actionables: Actionable[];
  overall_threat_level: 'critical' | 'high' | 'moderate' | 'low';
  summary: string;
  analyzed_count: number;
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

export interface VoterLocationStats {
  group_id: string;
  location_name: string | null;
  part_no: string | null;
  part_name: string | null;
  lat: number;
  lng: number;
  status: string;
  year: number;
  total_count: number;
  male_count: number;
  female_count: number;
  other_gender_count: number;
  average_age: number | null;
  status_counts: Record<string, number>;
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

export interface IngestedDataItem {
  id: string;
  platform: string;
  external_id: string;
  content: string | null;
  author: string | null;
  published_at: string | null;
  url: string | null;
  geo_region: string | null;
  engagement: Record<string, number>;
  ai_status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export interface IngestedDataResponse {
  items: IngestedDataItem[];
  total: number;
}

export interface ServiceHealthStatus {
  status: "healthy" | "unhealthy" | "unreachable";
  response_time_ms: number | null;
}

export interface QueueMetrics {
  messages: number;
  not_visible: number;
  dlq_messages: number | null;
}

export interface InfrastructureStatus {
  services: Record<string, ServiceHealthStatus>;
  queues: Record<string, QueueMetrics>;
  checked_at: string;
}

// Voter List types
export interface VoterListGroupItem {
  id: string;
  year: number;
  constituency: string;
  file_id: string;
  status: string;
  part_no: string | null;
  part_name: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
  voter_count: number;
}

export interface VoterListGroupsResponse {
  items: VoterListGroupItem[];
  total: number;
}

export interface VoterEntryItem {
  id: string;
  name: string;
  father_or_husband_name: string | null;
  relation_type: string | null;
  gender: string | null;
  age: number | null;
  voter_no: string | null;
  serial_no: number | null;
  epic_no: string | null;
  house_number: string | null;
  section: string | null;
  status: string | null;
  created_at: string;
}

export interface VoterListGroupDetail {
  id: string;
  year: number;
  constituency: string;
  file_id: string;
  status: string;
  part_no: string | null;
  part_name: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface VoterListGroupDetailResponse {
  group: VoterListGroupDetail;
  entries: VoterEntryItem[];
  total_entries: number;
}

export interface VoterEntryWithGroup extends VoterEntryItem {
  group_id: string;
}

export interface AllVoterEntriesResponse {
  items: VoterEntryWithGroup[];
  total: number;
}

export interface VoterListUploadResponse {
  file_id: string;
  s3_key: string;
  year: number;
  language: string;
  part_no: string | null;
  part_name: string | null;
  status: string;
}

export interface TopicKeyword {
  id: string;
  name: string;
  keywords: string[];
  sentiment_direction: "positive" | "negative" | "neutral";
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantOnboardRequest {
  tenant: {
    name: string;
    slug: string;
    constituency_code: string;
    settings?: Record<string, unknown>;
  };
  admin_email: string;
  admin_password: string;
  admin_name: string;
}
