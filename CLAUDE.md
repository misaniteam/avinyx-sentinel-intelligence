# Avinyx Sentinel Intelligence

Multi-tenant SaaS platform for political parties to track social media/news sentiment, voter analytics, and campaign management.

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + Shadcn UI + TanStack Query v5 + next-intl + next-themes + TypeScript
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2
- **Database:** PostgreSQL 16 (async via asyncpg), Firebase RTDB (live status + notifications)
- **AI:** Configurable per-tenant — Claude, OpenAI, or AWS Bedrock (provider factory pattern)
- **Infrastructure:** Docker Compose (local), AWS ECS/Fargate + RDS + SQS + SNS + S3 (prod)
- **Messaging:** SQS queues with DLQs for async pipeline, SNS for tenant events

## Monorepo Structure

```
├── packages/shared/          # sentinel_shared — Python package used by all backend services
│   └── sentinel_shared/
│       ├── models/           # SQLAlchemy models (14 models)
│       ├── schemas/          # Pydantic request/response schemas
│       ├── auth/             # JWT, bcrypt password hashing, FastAPI RBAC dependencies
│       ├── database/         # Async session, tenant context filtering
│       ├── messaging/        # SQS client
│       ├── storage/          # S3 async client (aiobotocore)
│       ├── ai/               # Provider factory + Claude/OpenAI/Bedrock implementations
│       ├── firebase/         # RTDB client
│       ├── logging/          # Sentry SDK init, structlog processors, log shipper
│       ├── data/             # Static data (wb_constituencies.py — 294 WB assembly constituencies)
│       └── config.py         # Pydantic Settings (reads from .env)
│
├── services/
│   ├── api-gateway/          # Port 8000 — CORS, rate limiting, reverse proxy
│   ├── auth-service/         # Port 8001 — Login, JWT, setup wizard, user/role CRUD, tenant settings
│   ├── tenant-service/       # Port 8002 — Tenant CRUD, onboarding
│   ├── ingestion-service/    # Port 8003 — Data source CRUD, scheduler, file upload, voter list upload
│   ├── ingestion-worker/     # SQS consumer — connector plugin pattern (8 handlers)
│   ├── ai-pipeline-service/  # SQS consumer — sentiment/topic/entity analysis
│   ├── analytics-service/    # Port 8005 — Dashboard, heatmap, reports, platforms, topics
│   ├── voter-service/        # SQS consumer — PDF voter list extraction via Textract + Bedrock
│   ├── campaign-service/     # Port 8006 — Campaigns, voters, media feeds, topic keywords
│   ├── notification-service/ # Port 8007 — Firebase notifications, list/mark-read (inline endpoints, no routers)
│   └── logging-service/      # Port 8008 — Centralized log collection, Sentry integration
│
├── frontend/                 # Next.js App Router
│   ├── messages/             # i18n JSON translations (en/, bn/, hi/)
│   └── src/
│       ├── app/[locale]/(auth)/     # Login, setup, forgot-password
│       ├── app/[locale]/(platform)/ # Authenticated shell — all main pages + admin/ + super-admin/
│       ├── app/api/export/          # Server-side PDF export route (Puppeteer)
│       ├── components/       # ui/ (Shadcn 19), layout/, shared/, charts/, dashboard/, heatmap/, admin/
│       ├── i18n/             # next-intl config, routing, navigation helpers
│       ├── lib/              # api/ (ky + hooks), auth/, tenant/, rbac/, export/, firebase/, constants/, data/
│       └── types/            # TypeScript interfaces (single index.ts, 30+ types)
│
├── migrations/               # Alembic (env.py imports sentinel_shared models, 10 migrations)
├── infrastructure/
│   ├── terraform/            # 8 modules (vpc, ecr, ecs, rds, sqs, s3, alb, cloudfront)
│   └── scripts/              # localstack-init, init-db, seed-superadmin
└── .github/workflows/        # CI, deploy, terraform, dependabot
```

## Key Commands

```bash
# Development
make up                    # Start all services via docker-compose
make down                  # Stop all services
make build                 # Build Docker images
make logs                  # Tail all service logs

# Production (docker-compose.yml + docker-compose.prod.yml)
make up-prod               # Start production services
make down-prod             # Stop production services
make build-prod            # Build production Docker images
make logs-prod             # Tail production logs

# Database
make migrate               # Run alembic upgrade head
make migrate-create        # Generate new Alembic migration (prompts for message)
make seed                  # Run migrate + create default super admin (admin@sentinel.dev / changeme123)

# Quality
make test                  # Run backend (pytest) + frontend (vitest) tests
make test-backend          # Backend tests only (all services + shared package)
make test-frontend         # Frontend tests only
make lint                  # ruff check + eslint
make format                # ruff format + prettier

# Sentry (optional, resource-heavy)
make sentry-setup          # First-time Sentry init (migrations + admin user)
make sentry-up             # Start Sentry services (profile-based)
make sentry-down           # Stop Sentry services
make sentry-logs           # Tail Sentry service logs

# Cleanup
make clean                 # Remove __pycache__, .next, node_modules, coverage artifacts
```

## Frontend Dev

```bash
cd frontend
npm install
npm run dev                # http://localhost:3000
npm run build              # Production build (standalone output)
npm test                   # Vitest
```

## Multi-Tenancy

- **Row-level isolation** via `tenant_id` column on all tenant-scoped tables
- Tenant ID sourced from JWT claims, set in Python `contextvars` (`tenant_context`)
- `TenantMixin` base class adds `tenant_id` column to models
- Super admin has `tenant_id=NULL` and `is_super_admin=True`
- **Constituency binding:** Each tenant optionally maps to a geographic constituency via `constituency_code` (unique, indexed) — used for location-aware data ingestion

## Auth & RBAC

**Hierarchy:**
1. **Super Admin** — `is_super_admin=True`, `tenant_id=NULL`, wildcard permissions (`*`)
2. **Tenant Admin** — Auto-created on tenant onboarding, has all tenant permissions
3. **Custom Roles** — RBAC with permission strings (e.g., `dashboard:view`, `voters:write`)

**JWT claims:** `sub`, `full_name`, `tenant_id`, `is_super_admin`, `roles`, `permissions`, `constituency_code`

**Auth dependencies** (`sentinel_shared/auth/dependencies.py`):
- `get_current_user` — Extracts user from JWT Bearer token
- `get_current_tenant` — Returns tenant_id from JWT (None for super admin)
- `get_current_tenant_required` — Like above but raises 400 if None (use for all tenant-scoped endpoints)
- `require_super_admin` — Rejects non-super-admin users
- `require_permissions("perm1", "perm2")` — Checks user has all listed permissions; wildcard `*` grants all

**Permission groups** (13 resources, defined in `lib/rbac/permissions.ts`):
dashboard (view/edit), voters (read/write), campaigns (read/write), media (read/write), analytics (read/export), reports (read/write/export), heatmap (view), users (read/write), roles (read/write), settings (read/write), workers (read/manage), data_sources (read/write), topics (read/write)

## First Deploy Flow

1. Backend detects no super admin → frontend shows `/setup` wizard
2. `POST /api/auth/setup` creates super admin (disabled after first use)
3. Super admin creates tenants via `POST /api/tenants/tenants` (auto-creates admin role + user)
4. Tenant admin manages users and custom roles

## API Gateway Routing

All frontend requests go through `api-gateway` at `/api/*`:
- `/api/auth/*` → auth-service (port 8001)
- `/api/tenants/*` → tenant-service (port 8002)
- `/api/ingestion/*` → ingestion-service (port 8003)
- `/api/analytics/*` → analytics-service (port 8005)
- `/api/campaigns/*` → campaign-service (port 8006)
- `/api/notifications/*` → notification-service (port 8007)
- `/api/logs/*` → logging-service (port 8008)

**Proxy path formula:** Strip `/api` prefix, concatenate `{service_prefix}{remaining_path}`. Example: `/api/analytics/dashboard/summary` → `http://analytics-service:8005/analytics/dashboard/summary`. Each service's router prefixes must include the service namespace.

**Extended timeout (300s):** `/file-upload`, `/voter-list-upload`, `/facebook-import`, `/generate-insights`, `/negative-analysis` — all other routes use 30s default

**Public (no auth):** `/api/auth/login`, `/api/auth/setup`, `/api/auth/setup-status`, `/api/auth/refresh`

## Service Routers

| Service | Routers / Prefix |
|---------|-----------------|
| auth-service | `auth.py` `/auth`, `users.py` `/auth/users`, `roles.py` `/auth/roles`, `settings.py` `/auth/tenant-settings` |
| tenant-service | `tenants.py` `/tenants/tenants` |
| ingestion-service | `data_sources.py` `/ingestion/data-sources`, `ingested_data.py` `/ingestion/ingested-data`, `file_upload.py` `/ingestion/file-upload`, `facebook_import.py` `/ingestion/facebook-import`, `voter_list_upload.py` `/ingestion/voter-list-upload`, `voter_list_data.py` `/ingestion/voter-lists` |
| analytics-service | `dashboard.py` `/analytics/dashboard` (summary, trends, negative-analysis, generate-insights), `heatmap.py` `/analytics/heatmap` (data, voter-location-stats), `platforms.py`, `reports.py`, `topics.py` — all `/analytics/*` |
| campaign-service | `campaigns.py` `/campaigns/campaigns`, `voters.py` `/campaigns/voters`, `media_feeds.py` `/campaigns/media-feeds`, `topic_keywords.py` `/campaigns/topic-keywords` |
| notification-service | Inline in `main.py` — 4 endpoints under `/notifications/*` |
| logging-service | `ingest.py`, `query.py` — all `/logs/*` |
| api-gateway | `proxy.py` (routing), `infrastructure.py` (health/metrics) |

## Async Pipeline

```
ingestion-service (APScheduler, 60s poll) → SQS:sentinel-ingestion-jobs → ingestion-worker (with location_context)
  → SQS:sentinel-ai-pipeline → ai-pipeline-service → SQS:sentinel-notifications → notification-service
```

All queues have dead-letter queues with `maxReceiveCount: 3`.

**Voter list pipeline (separate):** Upload → SQS:`sentinel-voter-list` → voter-service (Textract + Bedrock extraction)

## Data Source Connectors

### Existing connectors (registered in `handlers/__init__.py`):
- `youtube` — YouTube Data API v3 (config: `api_key`, `channel_ids`, `search_queries`)
- `twitter` — Twitter/X API v2 (config: `api_key`, `api_secret`, `bearer_token`, `search_queries`)
- `news_rss` — RSS feed ingestion (config: `feed_urls`)
- `news_api` — News API (config: `api_key`, `keywords`, `sources`, `language`)
- `reddit` — Reddit API with OAuth2 client credentials (config: `client_id`, `client_secret`, `subreddits`)
- `file_upload` — PDF/Excel file upload with S3 storage and text extraction (one-shot, no polling)
- `facebook_import` — XLSX upload of Facebook posts; each row → one RawMediaItem with `platform="facebook"` (one-shot, no polling)

### Adding a new connector:
1. Create `services/ingestion-worker/handlers/{platform}_handler.py`
2. Implement `BaseConnectorHandler.fetch(config, since, location_context=None) -> list[RawMediaItem]`
3. Register in `handlers/__init__.py` registry dict
4. Add platform to `ALLOWED_PLATFORMS` and `PLATFORM_CONFIG_SCHEMA` in `services/ingestion-service/routers/data_sources.py`
5. Add platform entry in frontend `PLATFORMS` array and `getConfigFieldsForPlatform()` in `components/admin/data-source-dialog.tsx`
6. Add platform icon/color in `platformConfig` in `lib/constants/platforms.ts`

### Location-aware ingestion:
Worker resolves tenant's `constituency_code` → constituency data → `location_context` dict `{code, name, district, lat, lng, keywords}`. All handlers accept optional `location_context` to augment/filter search queries.

## File Upload Data Source

- **Endpoint:** `POST /api/ingestion/file-upload` (multipart/form-data)
- **Formats:** PDF, Excel (`.xlsx`, `.xls`) — max 10 files, 50MB each
- **S3 storage:** `s3://sentinel-uploads/{tenant_id}/{data_source_id}/{uuid}_{filename}`
- **Text extraction:** `pymupdf` for PDF, `openpyxl` for XLSX, `xlrd` for XLS
- **Chunking:** Files with >500K chars split into multiple RawMediaItem records
- **One-shot:** DataSource created with `is_active=False`, `poll_interval_minutes=0`
- **Security:** Magic byte validation, filename sanitization, S3 SSE-AES256, cross-tenant S3 key validation, PDF page limit (2000), Excel row limit (500K)

## Facebook Import Data Source

- **Upload endpoint:** `POST /api/ingestion/facebook-import` (multipart/form-data — single XLSX file + name)
- **Template endpoint:** `GET /api/ingestion/facebook-import/template` — Downloads sample XLSX with required columns
- **Required XLSX columns:** `title`, `author`, `datetime`, `post_link`, `reaction_count`, `comments`
- **Processing:** Each row → one `RawMediaItem` with `platform="facebook"` (not `facebook_import`) for analytics grouping
- **Mapping:** content = title only (comments passed separately via raw_payload for independent sentiment analysis), url = post_link, engagement = {reactions, comments_text}, external_id = post_link
- **Comment Sentiment:** AI pipeline analyzes comments separately from post content; comment sentiment stored in `MediaFeed.engagement["comment_sentiment"]` with score/label/summary
- **One-shot:** DataSource created with `is_active=False`, `poll_interval_minutes=0` (same as file_upload)
- **Limits:** XLSX only, 50MB max, 100K row limit, flexible datetime parsing via `dateutil`
- **Frontend:** "Import Facebook Posts" option in data source dialog with template download button, XLSX-only dropzone

## Voter System

### Upload & List Endpoints
- `POST /api/ingestion/voter-list-upload` — Upload PDF (max 50MB) with year, language (en/bn/hi), optional part_no/part_name/location fields → S3 + SQS dispatch
- `GET /api/ingestion/voter-lists` — Paginated list of VoterListGroup records
- `GET /api/ingestion/voter-lists/{group_id}` — Group info + paginated voter entries
- `GET /api/ingestion/voter-lists/entries/all` — All entries across groups, filters: search, gender, status, section, group_id, age_min/max, limit up to 10000
- `PATCH /api/ingestion/voter-lists/{group_id}` — Update group metadata (part_no, part_name, location_name, location_lat, location_lng); requires `voters:write`
- `DELETE /api/ingestion/voter-lists/{group_id}` — Cascade deletes group + entries

### Voter Service (Textract + Bedrock Vision)
- **Dual extraction pipeline by language:**
  - **English:** Textract OCR → Bedrock text extraction
  - **Bengali/Hindi:** PDF → PNG strip images (3 strips/page, 4% overlap, Pillow enhancement) → Bedrock vision extraction
- **Async generator pattern:** `extract_voters_from_pdf()` yields `list[dict]` per chunk; DB inserts per chunk (not all-or-nothing)
- **Deduplication:** By EPIC + serial_no within chunks; cross-upload EPIC dedup via tenant DB lookup
- **Safety:** Phantom entry filter (no serial_no/voter_no), field truncation, gender normalization (Bengali/Hindi → English), truncated JSON recovery
- **Config:** `BEDROCK_VOTER_MODEL_ID` (default: Claude Sonnet), `AWS_TEXTRACT_*` env vars, SQS visibility 600s, `max_tokens=64000` (Claude Sonnet limit)

### Models
- `VoterListGroup` — tenant_id, year, constituency, file_id, status, part_no, part_name, location_name/lat/lng
- `VoterListEntry` — name, father_or_husband_name, relation_type, gender, age, voter_no, serial_no, epic_no, house_number, section, status

## AI Pipeline Service

- **Queue:** `sentinel-ai-pipeline` — processes `RawMediaItem` records through AI providers
- **Flow:** Receive tenant_id → query pending items in batches → fetch TopicKeyword records → AI `analyze_and_extract()` → create SentimentAnalysis + upsert MediaFeed → mark completed/failed
- **Batching:** 5 items/batch (`BATCH_SIZE`), single API call per batch, 5s inter-batch delay, loops until no pending items
- **Bedrock batch mode:** Multiple items combined into one prompt with `--- ITEM N ---` delimiters; model returns `{"results": [...]}` array. Falls back to individual calls if batch parsing fails.
- **Status tracking:** `RawMediaItem.ai_status`: `pending` → `processing` → `completed`/`failed`
- **Failure:** Items marked `failed` (not reset to pending) to prevent retry storms

### AI Providers
- **Base:** `BaseAIProvider` in `sentinel_shared/ai/base.py` — `analyze_sentiment()`, `extract_topics()`, `analyze_and_extract(topic_keywords=None)`
- **Claude:** `ClaudeProvider` — `claude-sonnet-4-20250514`, Anthropic messaging API
- **OpenAI:** `OpenAIProvider` — `gpt-4o`, JSON response format
- **Bedrock:** `BedrockProvider` — aiobotocore async, 5 retries with aggressive backoff for throttles, 3s inter-request delay, per-item error handling with 30s throttle cooldown, batch mode (up to 5 items per API call with individual fallback)
- **Result models:** `SentimentResult` (score -1.0→1.0, label, topics, entities, summary, comment_sentiment), `CommentSentimentResult` (score, label, summary), `ContentExtractionResult` (title, description, image_url, source_link, external_links)
- **Comment Sentiment:** All providers instruct AI to analyze comments separately when raw_payload contains `comments`/`comments_text` fields. Comment sentiment stored in `SentimentResult.comment_sentiment` (optional), then merged into `MediaFeed.engagement["comment_sentiment"]` by the pipeline

### Topic Keywords (Sentiment Guidance)
- Tenants define topics with keywords + sentiment direction (positive/negative/neutral) to guide AI classification
- `build_topic_keywords_prompt()` generates prompt section instructing AI to weight sentiment toward defined directions
- CRUD: `services/campaign-service/routers/topic_keywords.py` at `/api/campaigns/topic-keywords`

### Adding a new AI provider:
1. Create `packages/shared/sentinel_shared/ai/{provider}_provider.py`
2. Implement `BaseAIProvider` (`analyze_sentiment`, `extract_topics`, `analyze_and_extract`)
3. Register via `AIProviderFactory.register("name", ProviderClass)` in ai-pipeline-service main.py

## Media Feeds

- **Model:** `MediaFeed` in `sentinel_shared/models/media.py` — AI-enriched content with sentiment, topics, extracted metadata
- **Backend:** `GET /api/campaigns/media-feeds` — filters: platform, sentiment, topic, date_from, date_to; sort: published_at/sentiment_score/platform/author (asc/desc); pagination; permission: `media:read`
- **Frontend:** `/media-feeds` — Card-based view with sentiment badges, comment sentiment badges (MessageSquare icon), topic pills, images, external links, date range filter, sort dropdown
- **Hook:** `useMediaFeeds()` in `lib/api/hooks.ts`

## Heatmap Voter Stats

- **Backend:** `GET /api/analytics/heatmap/voter-location-stats` — aggregates voter entry stats per `VoterListGroup` with location coordinates (any status)
- **Response per group:** location_name, part_no/part_name, lat/lng, status, year, total/male/female/other counts, average_age, status_counts (e.g., `{"UNDER ADJUDICATION": 5, "SHIFTED": 2}`)
- **Frontend:** `VoterStatsMarkers` component renders `AdvancedMarker` pins on heatmap; click opens `InfoWindow` tooltip with stats
- **Hook:** `useVoterLocationStats()` in `lib/api/hooks.ts`

## Negative Coverage Analysis

- **Backend:** `GET /api/analytics/dashboard/negative-analysis` — fetches top 10 negative `MediaFeed` items, deduplicates by title, sends to AI for thematic analysis
- **AI output:** negative themes (with severity, summary, source counts), actionable recommendations (with priority, type, addressed themes), overall threat level, executive summary
- **Caching:** 15-minute in-memory cache per tenant; `?refresh=true` to bypass
- **Frontend:** Dashboard widget (`negative-analysis`) showing threat level badge, negative theme cards, recommended action cards with expand/collapse; shows skeleton during `isFetching && !data` to prevent flash of "no data" state
- **Hook:** `useNegativeAnalysis()` in `lib/api/hooks-analytics.ts`
- **Action types:** public_statement, policy_response, social_media, community_outreach, legal, internal

## Analytics Page (Advanced)

- **Page:** `/analytics` — Comprehensive analytics with advanced filtering, 5 charts, summary stats, and AI insights
- **Filters:** Multi-select platforms (checkbox popover), multi-select sentiments, date range presets (7d/30d/90d/all/custom), period selector (hourly/daily/weekly), topic limit (5-25)
- **Summary Stats:** 4 animated stat cards (total items, avg sentiment, positive rate, negative rate) — all computed from filtered sentiment trend data, not from the global dashboard summary
- **Charts:** Platform pie, Sentiment trends line, Top topics bar, Engagement area, Sentiment distribution donut — all respect date and platform filters
- **Generate Insights:** `POST /api/analytics/dashboard/generate-insights` — accepts filter params (date_from, date_to, platforms[], sentiments[]), gathers aggregated stats + sample items, sends to tenant AI provider, returns structured key_points (title, description, severity) + recommendations (action, priority, category, rationale) + executive summary
- **Hook:** `useGenerateInsights()` mutation in `lib/api/hooks-analytics.ts`
- **Types:** `AnalyticsInsights`, `InsightKeyPoint`, `InsightRecommendation` in `types/index.ts`
- **Frontend components:** `MultiSelectFilter` (checkbox popover), `StatCard` (animated), `InsightsPanel` (severity-colored key findings + priority-badged recommendations)

## Frontend Architecture

### State Management
- **Server state:** TanStack Query v5 via `lib/api/hooks.ts` (43 hooks) and `hooks-analytics.ts` (7 hooks)
- **Client state:** AuthProvider → TenantProvider → RBACProvider (composed contexts)
- **Real-time:** Firebase RTDB hooks for worker status and notifications
- **HTTP client:** `ky` with auto Bearer token and 401 redirect (`lib/api/client.ts`)
- **Access token:** Memory + `sessionStorage` (key: `sentinel_access_token`)

### Pages (23 routes)
**Auth:** login, setup, forgot-password
**Main:** dashboard, voters, voter-upload, media-feeds, heatmap, analytics, reports, campaigns
**Admin:** users, roles, data-sources, ingested-data, topics, settings, workers
**Super Admin:** tenants, infrastructure

### Component Patterns
- `<PermissionGate permission="voters:write">` — RBAC component-level gating
- `<AuthGuard>` — Redirects to /login if unauthenticated
- `<AppShell>` — Sidebar + Topbar + main content area
- `<ExportableContainer>` — Wraps content with PDF/PNG export buttons
- `<DeleteConfirmDialog>` — Reusable confirmation dialog
- `<TagInput>` — Pill-style tag input (Enter/comma to add, Backspace/X to remove)
- `<LocationSearch>` — Google Places Autocomplete (PlaceAutocompleteElement), falls back to text input without API key
- `<PlacesAutocompleteInput>` — Google Places search using AutocompleteService API with custom dropdown (works inside Radix Dialog portals unlike PlaceAutocompleteElement); used in voter list edit dialog
- Sidebar: Main navigation + Administration section (auto-filtered by permissions)

### Dashboard Widgets (8)
`react-grid-layout` (`<ResponsiveGridLayout>`) — drag-drop/resize, layout persisted to `localStorage`
Widgets: summary-stats, sentiment-trend, platform-breakdown, top-topics, engagement, sentiment-distribution, top-feeds, negative-analysis

**Sentiment Trends & Engagement widgets** include date range filter (presets: 7/30/90 days + calendar range picker) and period selector (hourly/daily/weekly). Sentiment trends aggregates directly from `MediaFeed` table via `date_trunc()` grouping (not from `SentimentAggregate`).

### Charts (`components/charts/`)
Pure presentational — accept typed data props, never call hooks internally:
SentimentLineChart, PlatformPieChart, TopTopicsBarChart, EngagementAreaChart, SentimentDistributionPie

### Admin CRUD Pattern
1. Page manages state: `dialogOpen`, `dialogMode` ("create"/"edit"), `selectedItem`
2. Dialog uses react-hook-form + zod validation
3. Submit → mutation hook → toast (sonner) → close → TanStack Query invalidation
4. Delete via `DeleteConfirmDialog` → delete mutation

### Export System
- **Client-side PDF/PNG:** `html2canvas-pro` + `jsPDF` via `useExport()` hook
- **Client-side Excel:** SheetJS `xlsx` — up to 10K entries with translated column headers

## Internationalization (i18n)

- **Library:** `next-intl` v4 with Next.js plugin
- **Locales:** `en` (English), `bn` (Bengali), `hi` (Hindi) — default: `en`
- **Routing:** `[locale]` segment, `localePrefix: 'never'` (clean URLs)
- **Switching:** Cookie-based (`NEXT_LOCALE`) via `LocaleSwitcher` in topbar
- **Translation files:** `messages/{en,bn,hi}/` — 11 root namespaces + `admin/` subfolder (7 files)
- **Usage:** `const t = useTranslations("namespace")` → `t("key")`
- **Fonts:** Inter (Latin), Noto Sans Bengali, Noto Sans Devanagari

### Adding a new translation namespace:
1. Create JSON files in `messages/{en,bn,hi}/`
2. Add dynamic import in `i18n/request.ts` `loadMessages()` function
3. Use `useTranslations("namespace")` in components

## Theme / Dark Mode

- `next-themes` with `attribute="class"`, `defaultTheme="system"`
- CSS variables in `globals.css` — `:root` (light) and `.dark` (dark)
- `ModeToggle` component in topbar

## Google Maps

- `@vis.gl/react-google-maps` with `visualization` + `places` libraries
- Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; optional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (needed for AdvancedMarker voter stats markers)
- Components: `MapProvider`, `SentimentHeatmap`, `HeatmapControls`, `VoterStatsMarkers`
- Default center: India (20.59, 78.96), zoom 5

## Constituency System

- 294 West Bengal assembly constituencies with code, name, district, lat/lng, bilingual keywords
- Dual data files: Python (`sentinel_shared/data/wb_constituencies.py`) + TypeScript (`lib/data/wb-constituencies.ts`)
- `ConstituencyCombobox` — searchable dropdown grouped by district
- One-to-one tenant binding via `constituency_code` unique constraint
- Endpoints: `GET /api/tenants/tenants/constituencies` (all), `GET .../constituencies/available` (unassigned)

## Logging & Sentry

- **Shared module:** `sentinel_shared/logging/` — `init_logging(service_name)`, structlog processors, background log shipper
- **Log shipper:** Background asyncio task, batches (max 50 / 2s interval), POSTs to logging-service, fire-and-forget
- **Logging service** (port 8008): PostgreSQL `log_entries` table, daily purge >30 days
  - `POST /logs/ingest` (internal, no auth), `GET /logs/search` + `GET /logs/stats` (super admin only)
- **Self-protection:** logging-service skips shipping its own logs
- **Sentry:** Self-hosted behind `sentry` Docker profile, shares postgres/redis
  - Setup: `make sentry-setup` → `make sentry-up` → `http://localhost:9000` → create project → copy DSN to `.env`
- **Graceful degradation:** No Sentry DSN = no Sentry init; logging-service down = logs silently dropped

### All services initialize logging:
```python
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper
# Startup: init_logging("service-name"); await start_log_shipper()
# Shutdown: await stop_log_shipper()
```

## Firebase Integration

- **Backend:** `sentinel_shared/firebase/client.py` — Admin SDK singleton, `update_worker_status()`, `push_notification()`
- **Frontend:** `lib/firebase/config.ts` + `lib/firebase/hooks.ts` — `useWorkerStatus()`, `useNotifications()`, `useNotificationCount()`
- **RTDB paths:** `/sentinel/workers/{tenant_id}/{worker_run_id}`, `/sentinel/notifications/{tenant_id}/{push_id}`
- Graceful degradation: hooks return empty data when Firebase is not configured

## Notification System

- **Backend** (notification-service, inline in main.py):
  - `POST /notifications/send` — Push to Firebase RTDB (requires `notifications:write`)
  - `GET /notifications/` — List recent notifications
  - `PATCH /notifications/notifications/{id}/read` — Mark read (path traversal validated)
  - `POST /notifications/notifications/mark-all-read` — Mark all read
- **Frontend:** `NotificationPanel` in topbar popover with unread count badge
- Types: `alert`, `info`, `warning`; limits: title 200 chars, message 2000 chars

## Backend Validation Patterns

- **Permission allowlist:** `VALID_PERMISSIONS` frozenset in `schemas/user.py` — wildcard `*` rejected
- **Platform allowlist:** `ALLOWED_PLATFORMS` tuple in ingestion router
- **Config schema validation:** Per-platform required/optional key definitions in `PLATFORM_CONFIG_SCHEMA`
- **Credential masking:** Keys matching "key", "secret", "token", "password" masked to `"****"` in responses
- **Config merge on update:** PATCH merges incoming with existing, preserving untouched credentials
- **SSRF protection:** Feed URLs validated for scheme + blocked internal IPs/hostnames
- **Tenant isolation:** All tenant-scoped endpoints use `get_current_tenant_required`
- **Unique constraints:** Role names per tenant, data source names per tenant, topic names per tenant
- **Pydantic `extra="forbid"`:** Rejects unexpected fields on create/update schemas

## Tenant Settings

- Stored in `tenant.settings` JSONB column, scoped keys: `ai`, `notifications`, `general`
- `PATCH /api/auth/tenant-settings` (settings:write), `GET /api/auth/tenant-settings` (settings:read)
- API key masked to `"****"` in responses
- Frontend: `SettingsAIForm`, `SettingsNotificationsForm`, `SettingsGeneralForm`

## Environment

Copy `.env.example` to `.env` for local dev. LocalStack provides SQS/SNS/S3 at `localhost:4566`.

Required: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (heatmap + location search), `NEXT_PUBLIC_FIREBASE_CONFIG` (JSON string)

Optional: `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (enables AdvancedMarker for voter stats on heatmap — create in Google Cloud Console > Map Management)

**Local frontend dev:** Copy `NEXT_PUBLIC_*` vars from root `.env` to `frontend/.env.local` — Next.js only reads client-side env vars from this file.

## Terraform Infrastructure

8 modules in `infrastructure/terraform/modules/`:
- **vpc** — VPC, 2 public + 2 private subnets, NAT Gateway, security groups
- **ecr** — 10 ECR repos (immutable tags, scan-on-push, 10-image lifecycle)
- **ecs** — Fargate cluster + optional EC2 GPU capacity provider (`enable_gpu=true`), Cloud Map, task defs for 7 HTTP + 2 worker + 1 frontend, IAM, auto-scaling
- **rds** — PostgreSQL 16, Multi-AZ, encrypted, auto-backups (7 days), Secrets Manager
- **sqs** — 3 queues with DLQs, SSE encryption, 300s visibility timeout
- **s3** — Reports bucket (versioned, IA lifecycle) + Frontend bucket (CloudFront OAC)
- **alb** — Internet-facing, HTTPS with ACM cert, health checks
- **cloudfront** — S3 origin with OAC, SPA routing, security headers

Secrets injected via Secrets Manager references in ECS container `secrets` block — never plaintext.

## CI/CD (GitHub Actions)

- **ci.yml** — Lint + test + build on push/PR to main
- **deploy.yml** — ECR push → migrations → ECS deploy (OIDC auth, environment protection)
- **terraform.yml** — Plan on push (when `infrastructure/terraform/**` changes), apply on manual dispatch
- **dependabot.yml** — Weekly for npm/pip/actions, monthly for Terraform

**Required GitHub config:** Secrets: `AWS_ROLE_ARN`, `AWS_ACCOUNT_ID` | Variables: `AWS_REGION`, `PRIVATE_SUBNETS`, `SECURITY_GROUPS` | Environments: `staging`, `production`

## Alembic Migrations

Migrations are baked into Docker images at build time. After creating a new migration:
1. Rebuild: `docker compose up -d --build auth-service`
2. Run: `make migrate`

Current migrations (10):
- `1c3a7f6385e7` — Initial schema (all tables)
- `6e74ac702418` — Add unique constraint on `roles(tenant_id, name)`
- `a3b1c2d4e5f6` — Add `constituency_code` to tenants (unique, indexed, nullable)
- `b4c2d3e5f7a8` — Add `log_entries` table
- `c5d3e4f6a7b9` — Add `voter_list_groups` and `voter_list_entries` tables (includes part_no/part_name, house_number, relation_type)
- `f8a6b9c0d1e2` — Add `location_name`, `location_lat`, `location_lng` to voter list groups
- `g9b7c0d1e2f3` — Increase `raw_media_items` column lengths (external_id 255→1024, author/author_id 255→512)
- `h0c8d1e2f3g4` — Add `media_feeds` table
- `i1d9e2f3g4h5` — Add `ai_status` column to `raw_media_items` (indexed, default 'pending')
- `j2e0f3g4h5i6` — Add `topic_keywords` table (tenant-scoped, unique name constraint)
