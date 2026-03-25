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

**OPC routes:**
- `/` - Home page (KPI stats, banner, recommended demands, OPC leaderboard)
- `/demands` - 抢单大厅 (demand hall with filters)
- `/demands/:id` - Demand detail with bid button
- `/orders` - 我的订单 (orders with status tabs)
- `/orders/:id` - Order detail with deliverable submission
- `/profile` - 个人中心 (OPC profile & portfolio)
- `/notifications` - 消息中心

**Publisher (发单方) routes:**
- `/publisher` - 工作台 (dashboard with stats, OPC recommendations, demand tracking)
- `/publisher/demands` - 需求管理列表 (demand list with status tabs + type filter)
- `/publisher/demands/new` - 发布新需求 (full demand creation form per PRD 2.1.2)
- `/publisher/demands/:id/edit` - 编辑需求 (edit existing demand, loads existing data)
- `/publisher/demand/:id` - 需求详情 (demand detail with bid review + OPC bid list, confirm/reject)
- `/publisher/orders` - 订单管理列表 (order list with status tabs, milestone progress)
- `/publisher/orders/:id` - 订单详情 (milestone review, deliverable list, acceptance + return actions)
- `/publisher/cockpit` - 驾驶舱 (operational analytics)
- `/publisher/disputes` - 争议处理

**Publisher Demand Creation Form includes all PRD fields:**
- 需求标题 (max 50 chars)
- 需求类型 (7 options)
- 需求描述 (textarea)
- 需求技能标签 (multi-select, 15 predefined options)
- 需求OPC等级 (C/B/A/不限)
- 预算范围 (min-max with settlement preview)
- 交付截止日期 (min: today+3 days)
- 派单模式 (公开抢单 / 定向派单)
- 抢单截止时间 (for open mode)
- 定向邀约OPC (for directed mode, searchable from OPC pool)
- 里程碑节点 (dynamic form, optional)
- 参考材料/附件 (file upload, optional)
- 紧急标记 (urgent toggle)
- Save as draft / Submit for review

**Shared Publisher Component:**
- `src/components/publisher/PublisherSidebar.tsx` - Shared sidebar with active route detection

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
