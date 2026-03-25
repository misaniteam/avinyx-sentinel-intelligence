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
│       ├── models/           # SQLAlchemy models (11 models)
│       ├── schemas/          # Pydantic request/response schemas
│       ├── auth/             # JWT, bcrypt password hashing, FastAPI RBAC dependencies
│       ├── database/         # Async session, tenant context filtering
│       ├── messaging/        # SQS client
│       ├── storage/          # S3 async client (aiobotocore)
│       ├── ai/               # Provider factory + Claude/OpenAI implementations
│       ├── firebase/         # RTDB client
│       ├── logging/          # Sentry SDK init, structlog processors, log shipper
│       ├── data/             # Static data (wb_constituencies.py — 294 WB assembly constituencies)
│       └── config.py         # Pydantic Settings (reads from .env)
│
├── services/
│   ├── api-gateway/          # Port 8000 — CORS, rate limiting, reverse proxy
│   ├── auth-service/         # Port 8001 — Login, JWT, setup wizard, user/role CRUD, tenant settings
│   ├── tenant-service/       # Port 8002 — Tenant CRUD, onboarding
│   ├── ingestion-service/    # Port 8003 — Data source CRUD, scheduler, file upload
│   ├── ingestion-worker/     # SQS consumer — connector plugin pattern
│   ├── ai-pipeline-service/  # SQS consumer — sentiment/topic/entity analysis
│   ├── analytics-service/    # Port 8005 — Dashboard, heatmap, reports, platforms, topics
│   ├── voter-service/        # SQS consumer — PDF voter list extraction via AWS Bedrock LLM
│   ├── campaign-service/     # Port 8006 — Campaigns, voters, media feeds
│   ├── notification-service/ # Port 8007 — Firebase notifications, list/mark-read
│   └── logging-service/     # Port 8008 — Centralized log collection, Sentry integration
│
├── frontend/                 # Next.js App Router
│   ├── messages/             # i18n JSON translations (en/, bn/, hi/)
│   └── src/
│       ├── app/[locale]/(auth)/     # Login, setup, forgot-password
│       ├── app/[locale]/(platform)/ # Authenticated shell — all main pages
│       ├── app/api/export/          # Server-side PDF export route (Puppeteer)
│       ├── components/       # ui/ (Shadcn), layout/, shared/, charts/, dashboard/, heatmap/, admin/
│       ├── i18n/             # next-intl config, routing, navigation helpers
│       ├── lib/              # api/ (ky + hooks), auth/, tenant/, rbac/, export/, firebase/, data/
│       └── types/            # TypeScript interfaces
│
├── migrations/               # Alembic (env.py imports sentinel_shared models)
├── infrastructure/
│   ├── terraform/            # 8 modules (vpc, ecr, ecs, rds, sqs, s3, alb, cloudfront)
│   └── scripts/              # localstack-init, init-db, seed-superadmin
└── .github/workflows/        # CI, deploy, terraform, dependabot
```

## Key Commands

```bash
make up                    # Start all services via docker-compose
make down                  # Stop all services
make build                 # Build Docker images
make logs                  # Tail all service logs
make migrate               # Run alembic upgrade head
make migrate-create m="x"  # Generate new Alembic migration
make seed                  # Create default super admin (admin@sentinel.dev / changeme123)
make test                  # Run backend + frontend tests
make lint                  # ruff + eslint
make format                # ruff format + prettier
make sentry-setup          # First-time Sentry init (migrations + admin user)
make sentry-up             # Start Sentry services (profile-based)
make sentry-down           # Stop Sentry services
make sentry-logs           # Tail Sentry service logs
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

## Auth Hierarchy

1. **Super Admin** — `is_super_admin=True`, `tenant_id=NULL`, wildcard permissions (`*`)
2. **Tenant Admin** — Auto-created on tenant onboarding, has all tenant permissions
3. **Custom Roles** — RBAC with permission strings (e.g., `dashboard:view`, `voters:write`)

JWT claims: `sub`, `tenant_id`, `is_super_admin`, `roles`, `permissions`, `constituency_code`

## First Deploy Flow

1. Backend detects no super admin → frontend shows `/setup` wizard
2. `POST /api/auth/setup` creates super admin (disabled after first use)
3. Super admin creates tenants via `POST /api/tenants/tenants` (auto-creates admin role + user)
4. Tenant admin manages users and custom roles

## API Gateway Routing

All frontend requests go through `api-gateway` at `/api/*`:
- `/api/auth/*` → auth-service
- `/api/tenants/*` → tenant-service
- `/api/ingestion/*` → ingestion-service
- `/api/analytics/*` → analytics-service
- `/api/campaigns/*` → campaign-service
- `/api/notifications/*` → notification-service
- `/api/logs/*` → logging-service

**Proxy path formula:** The gateway strips `/api` from the prefix and concatenates `{service_prefix}{remaining_path}`. For example, `/api/analytics/dashboard/summary` → `http://analytics-service:8005/analytics/dashboard/summary`. Each service's router prefixes must include the service namespace (e.g., analytics-service mounts routers at `/analytics/dashboard`, `/analytics/platforms`, etc.).

Public (no auth): `/api/auth/login`, `/api/auth/setup`, `/api/auth/setup-status`, `/api/auth/refresh`

## Async Pipeline

```
ingestion-service (APScheduler, 60s poll) → SQS:sentinel-ingestion-jobs → ingestion-worker (with location_context)
  → SQS:sentinel-ai-pipeline → ai-pipeline-service → SQS:sentinel-notifications → notification-service
```

All queues have dead-letter queues with `maxReceiveCount: 3`.

## Adding a New Data Source Connector

1. Create `services/ingestion-worker/handlers/{platform}_handler.py`
2. Implement `BaseConnectorHandler.fetch(config, since, location_context=None) -> list[RawMediaItem]`
3. Register in `handlers/__init__.py` registry dict
4. Add platform to `ALLOWED_PLATFORMS` and `PLATFORM_CONFIG_SCHEMA` in `services/ingestion-service/routers/data_sources.py`
5. Add platform entry in frontend `PLATFORMS` array and `getConfigFieldsForPlatform()` in `components/admin/data-source-dialog.tsx`
6. Add platform icon/color in `platformConfig` in `lib/constants/platforms.ts`
7. No changes needed to the worker orchestrator

### Existing connectors (registered in `handlers/__init__.py`):
- `brand24` — Brand24 API for Facebook/Instagram (config: `api_key`, `project_id`, `search_queries`)
- `youtube` — YouTube Data API v3 (config: `api_key`, `channel_ids`, `search_queries`)
- `twitter` — Twitter/X API v2 (config: `api_key`, `api_secret`, `bearer_token`, `search_queries`)
- `news_rss` — RSS feed ingestion (config: `feed_urls`)
- `news_api` — News API (config: `api_key`, `keywords`, `sources`, `language`)
- `reddit` — Reddit API with OAuth2 client credentials (config: `client_id`, `client_secret`, `subreddits`)
- `file_upload` — PDF/Excel file upload with S3 storage and text extraction (one-shot, no polling)

## File Upload Data Source

- **Endpoint:** `POST /api/ingestion/file-upload` (multipart/form-data)
- **Accepted formats:** PDF (`.pdf`), Excel (`.xlsx`, `.xls`)
- **Limits:** Max 10 files per upload, max 50MB per file
- **S3 storage:** `s3://sentinel-uploads/{tenant_id}/{data_source_id}/{uuid}_{filename}`
- **Text extraction:** `pymupdf` for PDF, `openpyxl` for XLSX, `xlrd` for XLS
- **Chunking:** Files with >500K chars of extracted text are split into multiple RawMediaItem records
- **One-shot ingestion:** DataSource created with `is_active=False`, `poll_interval_minutes=0` — scheduler ignores it
- **Security:** Magic byte validation, filename sanitization, S3 SSE-AES256, cross-tenant S3 key validation in worker, PDF page limit (2000), Excel row limit (500K)
- **Frontend:** File dropzone in DataSourceDialog when platform is `file_upload`, with drag-and-drop, file list, and client-side validation
- **Deduplication:** Uses S3 key as `external_id`, enforced by existing `uq_media_tenant_platform_ext` constraint

## Voter List Upload

- **Upload endpoint:** `POST /api/ingestion/voter-list-upload` (multipart/form-data)
  - Fields: `file` (PDF, max 50MB), `year` (int), `language` ("en"/"bn"/"hi"), `part_no` (string, optional, max 50), `part_name` (string, optional, max 255)
  - Validates PDF magic bytes, uploads to S3, dispatches SQS message to `sentinel-voter-list` queue
  - Permission: `voters:write`
- **List endpoint:** `GET /api/ingestion/voter-lists` — paginated list of `VoterListGroup` records with `part_no`, `part_name`, `constituency`, `year`, `status`, `voter_count`
- **Detail endpoint:** `GET /api/ingestion/voter-lists/{group_id}` — group info + paginated voter entries
- **Models:**
  - `VoterListGroup` — upload metadata: `tenant_id`, `year`, `constituency`, `file_id`, `status`, `part_no`, `part_name`
  - `VoterListEntry` — individual voter: `name`, `father_or_husband_name`, `gender`, `age`, `voter_no`, `house_number`, `relation_type`
- **Frontend page:** `/voter-upload` — UploadForm (PDF dropzone + year/language/part_no/part_name fields), GroupsListView (table with Part No/Part Name columns), GroupDetailView (group info card + voter entries table)
- **i18n keys:** `voters.partNo`, `voters.partName` in en/bn/hi

## Voter Service (Textract + Bedrock)

- **Service:** `services/voter-service/` — SQS consumer that processes uploaded voter list PDFs
- **Docker image:** `python:3.12-slim` — lightweight, no GPU required
- **Extraction pipeline:** Textract OCR → Bedrock LLM → JSON → DB
  1. pymupdf splits PDF into single pages
  2. Textract `detect_document_text` extracts raw text from each page
  3. Pages grouped into chunks (`BEDROCK_VOTER_PAGES_PER_CHUNK`, default 5)
  4. Each chunk sent to Bedrock LLM (`invoke_model`) which returns structured JSON voter records
  5. Deduplicated by EPIC number and inserted into DB
- **Model:** Configurable via `BEDROCK_VOTER_MODEL_ID` (default: Claude Sonnet)
- **AWS credentials:** Shared IAM user for both Textract and Bedrock (`AWS_TEXTRACT_*` env vars)
- **AWS permissions:** `textract:DetectDocumentText` + `bedrock:InvokeModel`
- **Error handling:** Per-page Textract retries + per-chunk Bedrock retries (2x with exponential backoff); failed pages/chunks skipped
- **SQS visibility timeout:** 600s (10 minutes) to accommodate OCR + LLM processing

## Adding a New AI Provider

1. Create `packages/shared/sentinel_shared/ai/{provider}_provider.py`
2. Implement `BaseAIProvider` (analyze_sentiment, extract_topics)
3. Register via `AIProviderFactory.register("name", ProviderClass)` in ai-pipeline-service main.py

## Frontend State Management

- **Server state:** TanStack Query v5 — all API data flows through `lib/api/hooks.ts` and `lib/api/hooks-analytics.ts`
- **Client state:** 3 React contexts composed in root: AuthProvider → TenantProvider → RBACProvider
- **Real-time:** Firebase RTDB hooks (`lib/firebase/hooks.ts`) for worker status and notifications
- **Query keys:** Centralized in `lib/api/query-keys.ts`
- **HTTP client:** `ky` with auto Bearer token injection and 401 redirect (`lib/api/client.ts`)
- **Access token:** Held in memory + `sessionStorage` (key: `sentinel_access_token`) for persistence across page reloads; refresh token via httpOnly cookie (TODO)

## Internationalization (i18n)

- **Library:** `next-intl` v4 with Next.js plugin (`createNextIntlPlugin` in `next.config.ts`)
- **Supported locales:** `en` (English), `bn` (Bengali/বাংলা), `hi` (Hindi/हिन्दी) — default: `en`
- **Routing:** `[locale]` dynamic segment in App Router; `localePrefix: 'never'` (URLs are clean, no `/en/` prefix)
- **Middleware:** `src/middleware.ts` handles locale negotiation via `createMiddleware(routing)`
- **Locale switching:** Cookie-based (`NEXT_LOCALE`) via `LocaleSwitcher` component in topbar
- **Navigation:** Locale-aware wrappers (`Link`, `redirect`, `useRouter`, `usePathname`) exported from `i18n/navigation.ts`
- **Translation files:** `frontend/messages/{en,bn,hi}/` — namespaced JSON (common, auth, navigation, dashboard, analytics, campaigns, voters, reports, notifications, superAdmin, validation + `admin/` subfolder)
- **Usage pattern:** `const t = useTranslations("namespace")` → `t("key")`
- **Fonts:** Multi-script via Google Fonts — Inter (Latin), Noto Sans Bengali, Noto Sans Devanagari — injected as CSS variables

### Adding a new translation namespace:
1. Create JSON files in `messages/{en,bn,hi}/`
2. Add dynamic import in `i18n/request.ts` `loadMessages()` function
3. Use `useTranslations("namespace")` in components

## Theme / Dark Mode

- **Library:** `next-themes` — `ThemeProvider` wraps app in `components/providers.tsx`
- **Config:** `attribute="class"`, `defaultTheme="system"`, `enableSystem=true`
- **Tailwind:** `darkMode: ["class"]` — `.dark` class on `<html>` toggles CSS variable themes
- **CSS variables:** Defined in `app/[locale]/globals.css` — `:root` (light) and `.dark` (dark) selectors
- **Toggle:** `ModeToggle` component in topbar — dropdown with Light / Dark / System options

## Component Patterns

- `<PermissionGate permission="voters:write">` — RBAC component-level gating
- `<AuthGuard>` — Redirects to /login if unauthenticated (used in platform layout)
- `<AppShell>` — Sidebar + Topbar + main content area
- `<ExportableContainer title="...">` — Wraps content with PDF/PNG export buttons
- `<DeleteConfirmDialog>` — Reusable confirmation dialog for delete actions
- `<TagInput>` — Pill-style tag input (Enter/comma to add, Backspace/X to remove) used for hashtag/topic entry
- Sidebar items auto-filtered by user permissions

## Charts & Visualizations

All chart components live in `components/charts/` and are **pure presentational** — they accept typed data props, never call hooks internally. Data fetching happens at the page or widget level.

- `SentimentLineChart` — Multi-platform line chart, Y-axis [-1, 1]
- `PlatformPieChart` — Media item counts per platform
- `TopTopicsBarChart` — Horizontal bar chart, sorted desc
- `EngagementAreaChart` — Stacked area (likes/shares/comments)
- `SentimentDistributionPie` — Donut chart (positive/negative/neutral)
- Shared colors and styles in `chart-theme.ts`

## Dashboard Widget System

- `react-grid-layout` (`<ResponsiveGridLayout>`) for drag-drop/resize
- Widget registry in `components/dashboard/widget-registry.ts` maps type strings to lazy-loaded components
- Layout persisted to `localStorage` per user (key: `sentinel-dashboard-layout`)
- Default layout: 6 widgets (summary stats, sentiment trend, platform breakdown, top topics, engagement, sentiment distribution)
- Each widget wrapped in `WidgetContainer` with Suspense, ErrorBoundary, drag handle, and remove button
- Add/remove/reset widgets via UI controls

## Google Maps Heatmap

- Uses `@vis.gl/react-google-maps` with `visualization` library
- Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var (shows warning if missing)
- Components: `MapProvider` (APIProvider wrapper), `SentimentHeatmap` (map + heatmap layer), `HeatmapControls` (sentiment filter, date range)
- Default center: India (20.59, 78.96), zoom 5

## Export System

- **Client-side:** `html2canvas-pro` + `jsPDF` via `useExport()` hook — captures DOM to PDF/PNG
- `ExportableContainer` component wraps content with export buttons (auto-hidden during capture via `data-export-hide`)
- Pure utilities in `lib/export/client-export.ts`: `captureElement`, `canvasToPdf`, `canvasToPng`, `downloadBlob`

## Analytics Service Endpoints

Beyond the original dashboard/heatmap/reports routers (all prefixed with `/analytics`):
- `GET /analytics/platforms/breakdown` — Media item count grouped by platform
- `GET /analytics/platforms/engagement-over-time` — Likes/shares/comments aggregated by period
- `GET /analytics/topics/top` — Top N topics via `jsonb_array_elements_text` SQL aggregation
- `POST /analytics/reports/{id}/generate` — Triggers report generation (409 if already generating)
- `GET /analytics/reports/{id}/download` — Returns presigned S3 URL (10-minute expiry)

All analytics endpoints require `analytics:read` or `reports:read/write` permissions and use `get_current_tenant_required` (rejects tenant_id=None).

## Logging & Sentry Integration

- **Shared module:** `sentinel_shared/logging/` — `init_logging(service_name)`, structlog processors, background log shipper
- **Setup:** `setup.py` — Initializes Sentry SDK (if DSN configured) + configures structlog processor chain
- **Processors:** `processors.py` — `SentryProcessor` (forwards ERROR/CRITICAL to Sentry), `LogShipperProcessor` (enqueues logs for HTTP shipping)
- **Shipper:** `shipper.py` — Background asyncio task batches log entries (max 50 / 2s interval) and POSTs to logging-service; fire-and-forget (no cascading failures)
- **Logging service:** `services/logging-service/` (port 8008) — Centralized log storage in PostgreSQL `log_entries` table
  - `POST /logs/ingest` — Batch log ingestion (internal, no auth)
  - `GET /logs/search` — Filter/paginate logs (super admin only)
  - `GET /logs/stats` — Aggregate counts by service/level (super admin only)
  - Daily purge of logs older than 30 days via APScheduler
- **Self-protection:** logging-service skips shipping its own logs (prevents infinite loop)
- **Sentry self-hosted:** Included in main `docker-compose.yml` behind the `sentry` profile (does not start by default)
  - First-time setup: `make sentry-setup` (runs DB migrations + creates admin user)
  - Start: `make sentry-up` (or `docker compose --profile sentry up -d`)
  - Stop: `make sentry-down`
  - Access at `http://localhost:9000`, login `admin@sentinel.dev / changeme123`
  - Create a Python project, copy DSN to `.env` as `SENTRY_DSN=http://<key>@sentry-web:9000/<project-id>`
  - Shares the app's `postgres` (separate `sentry` database, auto-created via init script) and `redis`
- **Graceful degradation:** If `SENTRY_DSN` is empty, Sentry is not initialized; if logging-service is down, logs are silently dropped

### All services initialize logging in their lifespan:
```python
from sentinel_shared.logging import init_logging, start_log_shipper, stop_log_shipper

# Startup:
init_logging("service-name")
await start_log_shipper()
# Shutdown:
await stop_log_shipper()
```

## Firebase Integration

- **Backend:** `sentinel_shared/firebase/client.py` — Admin SDK singleton, `update_worker_status()`, `push_notification()`
- **Frontend:** `lib/firebase/config.ts` — Client SDK init from `NEXT_PUBLIC_FIREBASE_CONFIG` env var (JSON string)
- **Hooks:** `lib/firebase/hooks.ts` — `useWorkerStatus()`, `useNotifications()`, `useNotificationCount()`
- **RTDB paths:** `/sentinel/workers/{tenant_id}/{worker_run_id}`, `/sentinel/notifications/{tenant_id}/{push_id}`
- **Security rules:** `database.rules.json` — deny-all; all access via backend admin SDK (bypasses rules)
- Graceful degradation: hooks return empty data when Firebase is not configured

## Notification System

- **Backend endpoints** (`notification-service`):
  - `POST /notifications/send` — Push to Firebase RTDB (requires `notifications:write`)
  - `GET /notifications/` — List recent notifications from RTDB
  - `PATCH /notifications/notifications/{id}/read` — Mark single notification read (validated against path traversal)
  - `POST /notifications/notifications/mark-all-read` — Mark all tenant notifications read
- **Frontend:** `NotificationPanel` in topbar popover, bell icon with unread count badge
- Notification types: `alert`, `info`, `warning` (enforced via Literal type)
- Input limits: title max 200 chars, message max 2000 chars

## Admin CRUD Pattern

All admin forms follow the same dialog-based pattern:
1. Page manages state: `dialogOpen`, `dialogMode` ("create"/"edit"), `selectedItem`
2. Dialog component receives mode + item, uses react-hook-form + zod validation
3. On submit: calls mutation hook (e.g., `useCreateUser()`, `useUpdateRole()`)
4. On success: toast via sonner, close dialog, TanStack Query auto-invalidates list
5. Delete: `DeleteConfirmDialog` with confirmation before calling delete mutation

### Admin pages with full CRUD:
- `/admin/users` — UserDialog (create/edit), role assignment, active toggle
- `/admin/roles` — Table view with search, RoleDialog (create/edit), PermissionSelect with per-module select all/deselect all + global select all + "X of Y selected" counter
- `/admin/data-sources` — Table view with platform badges/icons, DataSourceDialog (create/edit) with General + Credentials sections, per-platform config forms (password inputs for secrets, tag inputs for hashtags/topics), active/inactive toggle, SSRF-safe URL validation
- `/admin/ingested-data` — Read-only table of raw ingested items with platform filter, content search, date range, pagination, expandable row details
- `/admin/settings` — AI provider form, notification prefs, general settings
- `/admin/workers` — Live worker status cards via Firebase RTDB
- `/super-admin/tenants` — TenantDialog (onboard/edit), suspend/activate, constituency assignment
- `/super-admin/infrastructure` — Service health cards, queue metrics

### Permissions constant
`lib/rbac/permissions.ts` — `PERMISSION_GROUPS` defines all resources and actions (12 resources). Used by `PermissionSelect` and role creation.

### Backend validation patterns (established in roles + data sources):
- **Permission allowlist:** `VALID_PERMISSIONS` frozenset in `schemas/user.py` — roles can only contain known permission strings, wildcard `*` rejected
- **Platform allowlist:** `ALLOWED_PLATFORMS` tuple in ingestion router — data sources can only use registered platforms
- **Config schema validation:** Per-platform required/optional key definitions in `PLATFORM_CONFIG_SCHEMA` dict — unknown keys stripped, required keys enforced on create
- **Credential masking:** Sensitive config values (keys matching "key", "secret", "token", "password") masked to `"****"` in all GET/PATCH responses (recursive)
- **Config merge on update:** PATCH merges incoming config with existing values, preserving credentials not included in the update
- **SSRF protection:** Feed URLs validated for scheme (http/https only), blocked internal IPs/hostnames (localhost, 169.254.x.x, private ranges)
- **Tenant isolation:** All tenant-scoped endpoints use `get_current_tenant_required` (rejects super admin without tenant context)
- **Unique constraints:** Role names unique per tenant (`uq_roles_tenant_name`), data source names unique per tenant (checked in application layer)
- **Pydantic `extra="forbid"`:** Used on create/update schemas to reject unexpected fields (mass assignment prevention)

## Tenant Settings

- Stored in `tenant.settings` JSONB column, scoped by whitelisted keys: `ai`, `notifications`, `general`
- Backend: `PATCH /api/auth/tenant-settings` (requires `settings:write`), `GET /api/auth/tenant-settings` (requires `settings:read`)
- API key in `settings.ai.api_key` is masked to `"****"` in all GET/PATCH responses
- Frontend forms: `SettingsAIForm`, `SettingsNotificationsForm`, `SettingsGeneralForm`

## Data Source Management

- **Backend:** `services/ingestion-service/routers/data_sources.py` — CRUD with platform validation, config schema validation, credential masking, SSRF protection
- **Frontend page:** `/admin/data-sources` — Table view with platform badges (Brand24, YouTube, Twitter/X, News RSS, News API, Reddit), search, active/inactive status
- **Frontend dialog:** `components/admin/data-source-dialog.tsx` — Two-section form: General (name, platform select, poll interval, active toggle) + Credentials (platform-specific fields rendered conditionally)
- **Hashtag/topic entry:** Brand24, YouTube, and Twitter use `TagInput` component (`type: "tags"`) for `search_queries` — admin enters hashtags/topics as pill-style tags instead of free-text
- **Config field types:** `password`, `text`, `textarea`, `select`, `tags` — each rendered with appropriate UI component
- **Config handling:** API keys stored in JSONB `config` column, masked in responses, merged (not replaced) on update
- **Platform config:** Shared in `lib/constants/platforms.ts` (icon, label, color per platform) — imported by data-sources and ingested-data pages
- **Supported platforms:** brand24, youtube, twitter, news_rss, news_api, reddit
- **Adding a platform:** Update backend `ALLOWED_PLATFORMS` + `PLATFORM_CONFIG_SCHEMA`, frontend dialog `PLATFORMS` + `getConfigFieldsForPlatform()`, `lib/constants/platforms.ts`, and worker handler registry

## Constituency System

- **294 West Bengal assembly constituencies** with code, name, district, lat/lng, and bilingual search keywords (English + Bengali)
- **Dual data files:** Python (`sentinel_shared/data/wb_constituencies.py`) + TypeScript (`lib/data/wb-constituencies.ts`)
- **Frontend:** `ConstituencyCombobox` (`components/admin/constituency-combobox.tsx`) — searchable dropdown grouped by district, uses `cmdk` command component
- **Tenant binding:** One-to-one — each tenant maps to at most one constituency (`constituency_code` unique constraint)
- **Backend endpoints:**
  - `GET /api/tenants/tenants/constituencies` — All 294 constituencies
  - `GET /api/tenants/tenants/constituencies/available` — Unassigned constituencies only
- **Onboarding:** `TenantDialog` includes constituency selection on create; read-only on edit

## Automated Ingestion Scheduler

- **APScheduler** (async) runs `check_and_dispatch_polls()` every 60 seconds in `services/ingestion-service/scheduler.py`
- Queries active data sources where `last_polled_at + poll_interval` is overdue
- Dispatches SQS messages to `sentinel-ingestion-jobs` queue
- Updates `last_polled_at` to prevent double-dispatch
- Integrated into ingestion-service startup via `services/ingestion-service/main.py`

## Location-Aware Ingestion

- Worker resolves tenant's `constituency_code` → constituency data → `location_context` dict containing `{code, name, district, lat, lng, keywords}`
- All 6 connector handlers accept optional `location_context` parameter in `fetch()`
- Handlers use constituency keywords to augment/filter search queries for location-relevant content
- Flow: tenant `constituency_code` (from DB) → worker lookup → handler receives location context → location-filtered results

## Ingested Data

- **Backend:** `GET /ingestion/ingested-data` (`services/ingestion-service/routers/ingested_data.py`)
  - Filters: `platform`, `content` (search), `start_date`, `end_date`
  - Pagination: `skip`/`limit` (default 50, max 100)
  - Returns: `IngestedDataResponse` with items (id, platform, external_id, content, author, published_at, url, geo_region, engagement, created_at) + total count
- **Frontend page:** `/admin/ingested-data` — Read-only table view with platform filter dropdown, content search, date range, pagination, and expandable row details (full content, URL link, engagement breakdown)
- **Frontend hook:** `useIngestedData()` in `lib/api/hooks.ts`, query key `ingestedData`
- **Sidebar:** "Ingested Data" link with `FileSearch` icon, gated by `data_sources:read`
- **Permission:** `data_sources:read`

## Auth Dependencies

- `get_current_user` — Extracts user from JWT Bearer token
- `get_current_tenant` — Returns tenant_id from JWT (None for super admin)
- `get_current_tenant_required` — Like `get_current_tenant` but raises 400 if None (use for all tenant-scoped endpoints)
- `require_super_admin` — Rejects non-super-admin users
- `require_permissions("perm1", "perm2")` — Checks user has all listed permissions; wildcard `*` grants all

## Environment

Copy `.env.example` to `.env` for local dev. LocalStack provides SQS/SNS/S3 at `localhost:4566`.

Required for heatmap: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
Required for Firebase: `NEXT_PUBLIC_FIREBASE_CONFIG` (JSON string with apiKey, authDomain, projectId, databaseURL)

## Terraform Infrastructure

8 modules in `infrastructure/terraform/modules/`:
- **vpc** — VPC, 2 public + 2 private subnets, NAT Gateway, security groups (ALB, ECS, RDS)
- **ecr** — 10 ECR repos (immutable tags, scan-on-push, 10-image lifecycle)
- **ecs** — Fargate cluster, Cloud Map discovery, task defs for 7 HTTP + 2 worker services, IAM roles, auto-scaling for workers
- **rds** — PostgreSQL 16, Multi-AZ, encrypted, auto-backups (7 days), Secrets Manager password
- **sqs** — 3 queues with DLQs, SSE encryption, 300s visibility timeout
- **s3** — Reports bucket (versioned, IA lifecycle) + Frontend bucket (CloudFront OAC)
- **alb** — Internet-facing, HTTPS with ACM cert, health checks
- **cloudfront** — S3 origin with OAC, SPA routing, security response headers (HSTS, X-Frame-Options, etc.)

Secrets (DATABASE_URL, JWT_SECRET) injected via Secrets Manager references in ECS container `secrets` block — never plaintext.

### Deploying
```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars  # Edit with your values
terraform init
terraform plan
terraform apply  # Or via GitHub Actions workflow_dispatch
```

## CI/CD (GitHub Actions)

- **ci.yml** — Lint (ruff + eslint) + test (pytest + vitest) + build on push/PR to main
- **deploy.yml** — Build & push to ECR → run migrations → deploy to ECS (OIDC auth, environment protection)
- **terraform.yml** — Plan on push, apply only via manual dispatch (OIDC auth)
- **dependabot.yml** — Weekly updates for npm, pip, GitHub Actions; monthly for Terraform

### Required GitHub configuration:
- **Secrets:** `AWS_ROLE_ARN` (OIDC), `AWS_ACCOUNT_ID`
- **Variables:** `AWS_REGION`, `PRIVATE_SUBNETS`, `SECURITY_GROUPS`
- **Environments:** `staging` and `production` (configure protection rules with required reviewers for production)

## Alembic Migrations

Migrations are baked into Docker images at build time (no volume mounts). After creating a new migration on the host:
1. Rebuild the service: `docker compose up -d --build auth-service`
2. Run migration: `make migrate`

Current migrations:
- `1c3a7f6385e7` — Initial schema (all tables)
- `6e74ac702418` — Add unique constraint on `roles(tenant_id, name)`
- `a3b1c2d4e5f6` — Add `constituency_code` column to tenants (unique, indexed, nullable)
- `b4c2d3e5f7a8` — Add `log_entries` table with service/level/tenant/timestamp indexes
- `c5d3e4f6a7b9` — Add `voter_list_groups` and `voter_list_entries` tables
- `d6e4f5a7b8c0` — Add `house_number` and `relation_type` columns to voter list entries
- `e7f5a6b8c9d1` — Add `part_no` and `part_name` columns to voter list groups

## Implementation Status

- [x] Phase 1 — Foundation (monorepo, shared package, auth, gateway, tenants, frontend shell)
- [x] Phase 2 — Core Features (campaigns, voters, media feeds, ingestion, dashboard pages)
- [x] Phase 3 — AI & Analytics (Recharts charts, dashboard widgets, Google Maps heatmap, client-side PDF/PNG export, report generation)
- [x] Phase 4 — Real-time & Admin (Firebase live updates, notification bell, admin CRUD forms, tenant settings, worker monitoring, infrastructure page)
- [x] Phase 5 — Production (Terraform IaC, GitHub Actions CI/CD, Dependabot)
- [x] Phase 6 — Admin Enhancements (roles table view with enhanced PermissionSelect, data source management page with per-platform credential forms, backend security hardening with permission/config allowlist validation, SSRF protection, credential masking)
- [x] Phase 7 — Constituency & Ingestion (WB constituency system with tenant binding, automated APScheduler polling, location-aware connector handlers, ingested data browsing endpoint)
- [x] Phase 8 — Ingestion Completion (ingested data admin page with filters/pagination/expandable rows, tag input for hashtag/topic entry on Brand24/YouTube/Twitter, Reddit handler implementation, shared platform config extraction)
- [x] Phase 9 — Logging & Observability (centralized logging service with PostgreSQL storage, Sentry SDK integration across all services, structlog processors for error forwarding and log shipping, self-hosted Sentry Docker setup)
- [x] Phase 10 — Internationalization & Theming (next-intl with English/Bengali/Hindi locales, cookie-based locale switching, `[locale]` App Router segment, next-themes dark/light/system mode toggle, multi-script Google Fonts)
- [x] Phase 11 — File Upload Ingestion (PDF/Excel file upload as data source, S3 storage with SSE, text extraction via pymupdf/openpyxl/xlrd, one-shot ingestion, magic byte validation, cross-tenant S3 key protection)
- [x] Phase 12 — Voter List Processing (voter-service SQS worker with Textract OCR + Bedrock LLM structured extraction, PDF page splitting via pymupdf, Part No/Part Name upload metadata fields, voter list upload/list/detail endpoints)
