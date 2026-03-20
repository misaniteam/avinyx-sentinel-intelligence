# Avinyx Sentinel Intelligence

Multi-tenant SaaS platform for political parties to track social media/news sentiment, voter analytics, and campaign management.

## Features

- **Sentiment Dashboard** — Drag-and-drop widget grid with real-time sentiment trends, platform breakdowns, top topics, and engagement metrics
- **Heatmap** — Google Maps visualization of geo-located sentiment data with filtering by sentiment type and date range
- **Voter Analytics** — Voter database with demographics, sentiment scores, interaction tracking, and campaign assignment
- **Campaign Management** — Create and manage campaigns with target regions, keywords, date ranges, and media feed tracking
- **AI-Powered Analysis** — Configurable per-tenant AI providers (Claude, OpenAI, AWS Bedrock) for sentiment analysis, topic extraction, and entity recognition
- **Data Ingestion** — Modular connector system for Brand24 (Facebook/Instagram), YouTube, X/Twitter, and news RSS feeds
- **Real-time Notifications** — Firebase-powered live notifications with bell icon badge and notification panel
- **Worker Monitoring** — Live ingestion worker status via Firebase RTDB
- **Report Generation** — Create and export reports as PDF, PNG, or CSV with S3 storage and presigned download URLs
- **Multi-Tenant Isolation** — Row-level tenant isolation with per-tenant AI configuration, user management, and RBAC
- **Admin Panel** — Full CRUD for users, roles, and tenant settings with permission-based access control
- **Super Admin** — Tenant onboarding, infrastructure monitoring, and service health overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Shadcn UI, TanStack Query v5, Recharts, react-grid-layout |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 |
| Database | PostgreSQL 16 (asyncpg), Firebase RTDB |
| AI | Claude (Anthropic), OpenAI, AWS Bedrock — configurable per tenant |
| Messaging | AWS SQS (with DLQs), AWS SNS |
| Storage | AWS S3 |
| Infrastructure | Docker Compose (local), AWS ECS/Fargate + RDS (production) |

## Architecture

```
┌─────────────┐     ┌──────────────┐
│   Frontend   │────>│ API Gateway  │
│  (Next.js)   │     │  (Port 8000) │
└─────────────┘     └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼──────┐
    │   Auth     │   │  Tenant   │   │ Analytics  │   ...6 more services
    │  Service   │   │  Service  │   │  Service   │
    │ (Port 8001)│   │(Port 8002)│   │(Port 8005) │
    └─────┬──────┘   └─────┬─────┘   └─────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │  (Port 5432) │
                    └──────────────┘

Async Pipeline:
ingestion-service → SQS → ingestion-worker → SQS → ai-pipeline → SQS → notification-service
```

### Microservices

| Service | Port | Purpose |
|---------|------|---------|
| api-gateway | 8000 | CORS, rate limiting, JWT validation, reverse proxy |
| auth-service | 8001 | Login, JWT, user/role CRUD, tenant settings |
| tenant-service | 8002 | Tenant onboarding, CRUD |
| ingestion-service | 8003 | Data source config, scheduler |
| ingestion-worker | — | SQS consumer, external API connectors |
| ai-pipeline-service | — | SQS consumer, sentiment/topic/entity analysis |
| analytics-service | 8005 | Dashboard, heatmap, reports, platform/topic analytics |
| campaign-service | 8006 | Campaigns, voters, media feeds |
| notification-service | 8007 | Firebase notifications, list/mark-read |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- Python 3.12+
- Make

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/misaniteam/avinyx-sentinel-intelligence.git
   cd avinyx-sentinel-intelligence
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your API keys (optional for local dev)
   ```

3. **Start all services**

   ```bash
   make up
   ```

   This starts PostgreSQL, Redis, LocalStack (SQS/SNS/S3), all 9 backend services, and the frontend.

4. **Run database migrations**

   ```bash
   make migrate
   ```

5. **Seed the super admin** (optional)

   ```bash
   make seed
   # Creates admin@sentinel.local / changeme123
   ```

6. **Open the app**

   Navigate to [http://localhost:3000](http://localhost:3000). On first visit with no super admin, you'll see the setup wizard.

### Frontend-Only Development

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
npm run build     # Production build
npm test          # Run Vitest tests
```

### Useful Commands

```bash
make up            # Start all services
make down          # Stop all services
make build         # Rebuild Docker images
make logs          # Tail all service logs
make migrate       # Run Alembic migrations
make test          # Run all tests (backend + frontend)
make lint          # ruff + eslint
make format        # ruff format + prettier
```

## Project Structure

```
avinyx-sentinel-intelligence/
├── packages/shared/          # sentinel_shared — shared Python package
│   └── sentinel_shared/
│       ├── models/           # SQLAlchemy models (10 models)
│       ├── schemas/          # Pydantic request/response schemas
│       ├── auth/             # JWT, password hashing, RBAC dependencies
│       ├── database/         # Async session, tenant context filtering
│       ├── messaging/        # SQS client
│       ├── ai/               # AI provider factory (Claude, OpenAI, Bedrock)
│       └── firebase/         # RTDB client (worker status, notifications)
│
├── services/                 # 9 FastAPI microservices
│
├── frontend/                 # Next.js 15 App Router
│   └── src/
│       ├── app/(auth)/       # Login, setup wizard, forgot password
│       ├── app/(platform)/   # All authenticated pages
│       ├── components/       # ui/, layout/, shared/, charts/, dashboard/, heatmap/, admin/
│       ├── lib/              # api/, auth/, tenant/, rbac/, export/, firebase/
│       └── types/            # TypeScript interfaces
│
├── migrations/               # Alembic database migrations
├── infrastructure/           # Terraform (TODO), LocalStack init, seed scripts
├── database.rules.json       # Firebase RTDB security rules
├── docker-compose.yml        # Local dev (12 containers)
└── Makefile                  # Dev workflow commands
```

## Multi-Tenancy

Data is isolated at the row level via a `tenant_id` column on all tenant-scoped tables. The tenant ID is extracted from JWT claims and injected into database queries via Python `contextvars`. Super admins operate across tenants with `tenant_id=NULL`.

## Auth & RBAC

Three-tier hierarchy:

1. **Super Admin** — Manages all tenants, wildcard `*` permissions
2. **Tenant Admin** — Auto-created on tenant onboarding, full tenant permissions
3. **Custom Roles** — Granular RBAC with 24 permission strings across 12 resources

### First Deploy Flow

1. No super admin detected → `/setup` wizard appears
2. Create super admin account
3. Super admin onboards tenants (auto-creates tenant admin)
4. Tenant admin creates users and custom roles

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) | Yes |
| `JWT_SECRET` | Secret for signing JWTs | Yes |
| `AWS_ENDPOINT_URL` | LocalStack URL for local dev | Local only |
| `NEXT_PUBLIC_API_URL` | API gateway URL for frontend | Yes |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key for heatmap | For heatmap |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Firebase config JSON string | For real-time |
| `ANTHROPIC_API_KEY` | Claude API key | For AI |
| `OPENAI_API_KEY` | OpenAI API key | For AI |

See `.env.example` for the complete list.

## Extending

### Adding a Data Source Connector

1. Create `services/ingestion-worker/handlers/{platform}_handler.py`
2. Implement `BaseConnectorHandler.fetch(config, since) -> list[RawMediaItem]`
3. Register in `handlers/__init__.py`

### Adding an AI Provider

1. Create `packages/shared/sentinel_shared/ai/{provider}_provider.py`
2. Implement `BaseAIProvider` (analyze_sentiment, extract_topics)
3. Register via `AIProviderFactory.register()` in ai-pipeline-service

## Implementation Status

- [x] **Phase 1** — Foundation (monorepo, shared package, auth, gateway, tenants, frontend shell)
- [x] **Phase 2** — Core Features (campaigns, voters, media feeds, ingestion, dashboard pages)
- [x] **Phase 3** — AI & Analytics (Recharts charts, dashboard widgets, Google Maps heatmap, PDF/PNG export, report generation)
- [x] **Phase 4** — Real-time & Admin (Firebase live updates, notification bell, admin CRUD forms, tenant settings, worker monitoring)
- [x] **Phase 5** — Production (Terraform IaC, GitHub Actions CI/CD, Dependabot)

## License

Proprietary. All rights reserved.
