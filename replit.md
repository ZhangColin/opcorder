# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080)
│   ├── jiedanba/           # React+Vite frontend (接单吧 platform)
│   └── mockup-sandbox/     # Component preview server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package
```

## 接单吧 (JieDanBa) - OPC Matching Platform V1.0

### Product Description
OPC (One Person Company) matching/trading platform connecting demand publishers (发单方) with freelancers (OPC). All UI is in Simplified Chinese.

### Design
- Primary color: deep blue (#00327d)
- Secondary color: green (#006b5a)
- Enterprise professional feel with glassmorphism elements

### Database Schema (8 tables)
- `users` - Platform users (roles: opc, publisher, admin)
- `opc_profiles` - OPC freelancer profiles with levels (C/B/A), skills, ratings
- `demands` - Published project demands with types, budgets, deadlines
- `bids` - OPC bids on demands
- `orders` - Matched orders between publishers and OPCs
- `deliverables` - Order deliverable submissions
- `portfolios` - OPC portfolio/work samples
- `notifications` - User notifications

### Demand Types
ai_education, gov_training, ai_research, party_building, livestream_media, ai_tool_dev, other

### OPC Levels
C=新手, B=进阶, A=专家

### Settlement Formula
OPC gets 60%, publisher 30%, platform fee 10%

### Frontend Routes
- `/` - Home page (KPI stats, banner, recommended demands, OPC leaderboard)
- `/demands` - 抢单大厅 (demand hall with filters)
- `/demands/:id` - Demand detail with bid button
- `/create-demand` - 发布需求 form
- `/orders` - 我的订单 (orders with status tabs)
- `/orders/:id` - Order detail with deliverable submission
- `/profile` - 个人中心 (OPC profile & portfolio)
- `/notifications` - 消息中心

### API Endpoints (mounted at /api)
- `GET /api/health` - Health check
- `GET /api/stats/overview` - Platform statistics
- `GET /api/users/me` - Current user (demo: returns first OPC user)
- `GET /api/users/opc-leaderboard` - Top OPCs
- `GET /api/demands` - List demands (with filters)
- `POST /api/demands` - Create demand
- `GET /api/demands/:id` - Demand detail
- `POST /api/bids` - Submit bid
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Order detail with deliverables
- `POST /api/orders/:orderId/deliverables` - Submit deliverable
- `POST /api/orders/:orderId/accept` - Accept delivery
- `POST /api/orders/:orderId/reject` - Reject delivery
- `GET /api/portfolios` - List portfolios
- `GET /api/notifications` - List notifications

### Demo Data
- 9 users (1 publisher: 海创元运营团队, 6 OPCs, 1 admin, 1 extra publisher)
- 8 demands across different categories
- 3 orders in various states (in_progress, pending_acceptance, completed)
- Portfolios and notifications seeded for OPC users

### V1.0 Limitations (by design)
- No real authentication - uses mock user (张明远, OPC user ID 2)
- No file upload for deliverables (text links only)
- No real-time notifications (poll-based)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Key Commands

- API codegen: `pnpm --filter @workspace/api-spec run codegen`
- DB push: `pnpm --filter @workspace/db run push`
- Seed data: `pnpm --filter @workspace/scripts run seed`
- Dev servers: Managed via Replit workflows
