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
│   ├── auth-service/         # Port 8001 — Login, JWT, setup wizard, user/role CRUD
│   ├── tenant-service/       # Port 8002 — Tenant CRUD, onboarding
│   ├── ingestion-service/    # Port 8003 — Data source CRUD, scheduler
│   ├── ingestion-worker/     # SQS consumer — connector plugin pattern
│   ├── ai-pipeline-service/  # SQS consumer — sentiment/topic/entity analysis
│   ├── analytics-service/    # Port 8005 — Dashboard, heatmap, reports
│   ├── campaign-service/     # Port 8006 — Campaigns, voters, media feeds
│   └── notification-service/ # Port 8007 — Firebase notifications
│
├── frontend/                 # Next.js App Router
│   └── src/
│       ├── app/(auth)/       # Login, setup, forgot-password
│       ├── app/(platform)/   # Authenticated shell — all main pages
│       ├── components/       # ui/ (Shadcn), layout/, shared/, admin/
│       ├── lib/              # api/ (ky + hooks), auth/, tenant/, rbac/
│       └── types/            # TypeScript interfaces
│
├── migrations/               # Alembic (env.py imports sentinel_shared models)
└── infrastructure/           # Terraform (TODO), scripts (localstack-init, seed)
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

- **Server state:** TanStack Query v5 — all API data flows through `lib/api/hooks.ts`
- **Client state:** 3 React contexts composed in root: AuthProvider → TenantProvider → RBACProvider
- **Query keys:** Centralized in `lib/api/query-keys.ts`
- **HTTP client:** `ky` with auto Bearer token injection and 401 redirect (`lib/api/client.ts`)
- **Access token:** Held in memory (never localStorage); refresh token via httpOnly cookie (TODO)

## Component Patterns

- `<PermissionGate permission="voters:write">` — RBAC component-level gating
- `<AuthGuard>` — Redirects to /login if unauthenticated (used in platform layout)
- `<AppShell>` — Sidebar + Topbar + main content area
- Sidebar items auto-filtered by user permissions

## Environment

Copy `.env.example` to `.env` for local dev. LocalStack provides SQS/SNS/S3 at `localhost:4566`.

## Implementation Status

- [x] Phase 1 — Foundation (monorepo, shared package, auth, gateway, tenants, frontend shell)
- [x] Phase 2 — Core Features (campaigns, voters, media feeds, ingestion, dashboard pages)
- [ ] Phase 3 — AI & Analytics (Recharts charts, Google Maps heatmap, PDF export)
- [ ] Phase 4 — Real-time & Admin (Firebase live updates, notification bell, admin forms)
- [ ] Phase 5 — Production (Terraform, GitHub Actions CI/CD, load testing)
