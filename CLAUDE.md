# Avinyx Sentinel Intelligence

Multi-tenant SaaS platform for political parties to track social media/news sentiment, voter analytics, and campaign management.

## Tech Stack

- **Frontend:** Next.js 15 (App Router) + Shadcn UI + TanStack Query v5 + TypeScript
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2
- **Database:** PostgreSQL 16 (async via asyncpg), Firebase RTDB (live status + notifications)
- **AI:** Configurable per-tenant — Claude, OpenAI, or AWS Bedrock (provider factory pattern)
- **Infrastructure:** Docker Compose (local), AWS ECS/Fargate + RDS + SQS + SNS + S3 (prod)
- **Messaging:** SQS queues with DLQs for async pipeline, SNS for tenant events

## Monorepo Structure

```
├── packages/shared/          # sentinel_shared — Python package used by all backend services
│   └── sentinel_shared/
│       ├── models/           # SQLAlchemy models (10 models)
│       ├── schemas/          # Pydantic request/response schemas
│       ├── auth/             # JWT, password hashing, FastAPI RBAC dependencies
│       ├── database/         # Async session, tenant context filtering
│       ├── messaging/        # SQS client
│       ├── ai/               # Provider factory + Claude/OpenAI implementations
│       ├── firebase/         # RTDB client
│       └── config.py         # Pydantic Settings (reads from .env)
│
├── services/
│   ├── api-gateway/          # Port 8000 — CORS, rate limiting, reverse proxy
│   ├── auth-service/         # Port 8001 — Login, JWT, setup wizard, user/role CRUD, tenant settings
│   ├── tenant-service/       # Port 8002 — Tenant CRUD, onboarding
│   ├── ingestion-service/    # Port 8003 — Data source CRUD, scheduler
│   ├── ingestion-worker/     # SQS consumer — connector plugin pattern
│   ├── ai-pipeline-service/  # SQS consumer — sentiment/topic/entity analysis
│   ├── analytics-service/    # Port 8005 — Dashboard, heatmap, reports, platforms, topics
│   ├── campaign-service/     # Port 8006 — Campaigns, voters, media feeds
│   └── notification-service/ # Port 8007 — Firebase notifications, list/mark-read
│
├── frontend/                 # Next.js App Router
│   └── src/
│       ├── app/(auth)/       # Login, setup, forgot-password
│       ├── app/(platform)/   # Authenticated shell — all main pages
│       ├── app/api/export/   # Server-side PDF export route (Puppeteer)
│       ├── components/       # ui/ (Shadcn), layout/, shared/, charts/, dashboard/, heatmap/, admin/
│       ├── lib/              # api/ (ky + hooks), auth/, tenant/, rbac/, export/, firebase/
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
make seed                  # Create default super admin
make test                  # Run backend + frontend tests
make lint                  # ruff + eslint
make format                # ruff format + prettier
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

## Auth Hierarchy

1. **Super Admin** — `is_super_admin=True`, `tenant_id=NULL`, wildcard permissions (`*`)
2. **Tenant Admin** — Auto-created on tenant onboarding, has all tenant permissions
3. **Custom Roles** — RBAC with permission strings (e.g., `dashboard:view`, `voters:write`)

JWT claims: `sub`, `tenant_id`, `is_super_admin`, `roles`, `permissions`

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

Public (no auth): `/api/auth/login`, `/api/auth/setup`, `/api/auth/setup-status`, `/api/auth/refresh`

## Async Pipeline

```
ingestion-service (scheduler) → SQS:sentinel-ingestion-jobs → ingestion-worker
  → SQS:sentinel-ai-pipeline → ai-pipeline-service → SQS:sentinel-notifications → notification-service
```

All queues have dead-letter queues with `maxReceiveCount: 3`.

## Adding a New Data Source Connector

1. Create `services/ingestion-worker/handlers/{platform}_handler.py`
2. Implement `BaseConnectorHandler.fetch(config, since) -> list[RawMediaItem]`
3. Register in `handlers/__init__.py` registry dict
4. No changes needed to the worker orchestrator

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
- **Access token:** Held in memory (never localStorage); refresh token via httpOnly cookie (TODO)

## Component Patterns

- `<PermissionGate permission="voters:write">` — RBAC component-level gating
- `<AuthGuard>` — Redirects to /login if unauthenticated (used in platform layout)
- `<AppShell>` — Sidebar + Topbar + main content area
- `<ExportableContainer title="...">` — Wraps content with PDF/PNG export buttons
- `<DeleteConfirmDialog>` — Reusable confirmation dialog for delete actions
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

Beyond the original dashboard/heatmap/reports routers:
- `GET /platforms/breakdown` — Media item count grouped by platform
- `GET /platforms/engagement-over-time` — Likes/shares/comments aggregated by period
- `GET /topics/top` — Top N topics via `jsonb_array_elements_text` SQL aggregation
- `POST /reports/{id}/generate` — Triggers report generation (409 if already generating)
- `GET /reports/{id}/download` — Returns presigned S3 URL (10-minute expiry)

All analytics endpoints require `analytics:read` or `reports:read/write` permissions and use `get_current_tenant_required` (rejects tenant_id=None).

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
  - `PATCH /notifications/{id}/read` — Mark single notification read (validated against path traversal)
  - `POST /notifications/mark-all-read` — Mark all tenant notifications read
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
- `/admin/roles` — RoleDialog (create/edit), PermissionSelect checkbox grid
- `/admin/settings` — AI provider form, notification prefs, general settings
- `/admin/workers` — Live worker status cards via Firebase RTDB
- `/super-admin/tenants` — TenantDialog (onboard/edit), suspend/activate
- `/super-admin/infrastructure` — Service health cards, queue metrics

### Permissions constant
`lib/rbac/permissions.ts` — `PERMISSION_GROUPS` defines all resources and actions (12 resources). Used by `PermissionSelect` and role creation.

## Tenant Settings

- Stored in `tenant.settings` JSONB column, scoped by whitelisted keys: `ai`, `notifications`, `general`
- Backend: `PATCH /api/auth/tenant-settings` (requires `settings:write`), `GET /api/auth/tenant-settings` (requires `settings:read`)
- API key in `settings.ai.api_key` is masked to `"****"` in all GET/PATCH responses
- Frontend forms: `SettingsAIForm`, `SettingsNotificationsForm`, `SettingsGeneralForm`

## Auth Dependencies

- `get_current_user` — Extracts user from JWT Bearer token
- `get_current_tenant` — Returns tenant_id from JWT (None for super admin)
- `get_current_tenant_required` — Like `get_current_tenant` but raises 400 if None (use for tenant-scoped endpoints)
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

## Implementation Status

- [x] Phase 1 — Foundation (monorepo, shared package, auth, gateway, tenants, frontend shell)
- [x] Phase 2 — Core Features (campaigns, voters, media feeds, ingestion, dashboard pages)
- [x] Phase 3 — AI & Analytics (Recharts charts, dashboard widgets, Google Maps heatmap, client-side PDF/PNG export, report generation)
- [x] Phase 4 — Real-time & Admin (Firebase live updates, notification bell, admin CRUD forms, tenant settings, worker monitoring, infrastructure page)
- [x] Phase 5 — Production (Terraform IaC, GitHub Actions CI/CD, Dependabot)
