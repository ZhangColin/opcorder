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

### Database Schema (10 tables)
- `users` - Platform users (roles: opc, publisher, admin)
- `opc_profiles` - OPC freelancer profiles with levels (C/B/A), skills, ratings
- `demands` - Published project demands with types, budgets, deadlines
- `bids` - OPC bids on demands
- `orders` - Matched orders between publishers and OPCs
- `deliverables` - Order deliverable submissions
- `portfolios` - OPC portfolio/work samples
- `notifications` - User notifications
- `courses` - Training courses (title, category, level, price, syllabusUrl, instructor, status: draft/published/closed)
- `enrollments` - OPC course enrollments (progressPct, paymentStatus: free/pending/paid, certIssued)

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
- `/orders/:id` - Order detail with **milestone timeline** (per-milestone deliverable submit, rejected re-submit, feedback display)
- `/profile` - 个人中心 (OPC profile, skills, certifications, income quick link)
- `/income` - 收入结算 (income/settlement center, KPIs, per-order settlement table)
- `/notifications` - 消息中心 (**upgraded**: category tabs, single mark-read, jump to order/demand, directed-invite Accept/Reject inline)

**Publisher (发单方) routes:**
- `/publisher` - 工作台 (dashboard with stats, OPC recommendations, demand tracking)
- `/publisher/demands` - 需求管理列表 (demand list with status tabs + type filter)
- `/publisher/demands/new` - 发布新需求 (full demand creation form per PRD 2.1.2)
- `/publisher/demands/:id/edit` - 编辑需求 (edit existing demand, loads existing data)
- `/publisher/demand/:id` - 需求详情 (demand detail with bid review + OPC bid list, confirm/reject)
- `/publisher/orders` - 订单管理列表 (order list with status tabs, milestone progress)
- `/publisher/orders/:id` - 订单详情 (milestone review, deliverable list, acceptance + return actions)
- `/publisher/opc-library` - OPC 人才库 (OPC grid with level/skill filters, detail drawer with portfolio)
- `/publisher/notifications` - 消息中心 (notification list, mark read, filter by category, jump to related demand/order)
- `/publisher/finance` - 财务中心 (**new**: KPI cards + order breakdown table with amounts, statuses, ratings)
- `/publisher/cockpit` - 驾驶舱 (operational analytics, orphaned)
- `/publisher/disputes` - 争议处理 (orphaned)

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
- `POST /api/orders/:orderId/accept` - Accept delivery (publisher rates OPC: rating+comment)
- `POST /api/orders/:orderId/reject` - Reject delivery (**updated**: counts rejections, auto-disputes after 3 revisions)
- `POST /api/orders/:orderId/opc-review` - OPC rates publisher (**new**: opcRating+opcReviewComment)
- `GET /api/portfolios` - List portfolios
- `GET /api/notifications` - List notifications
- `GET /api/posts/:postId/comments` - List post comments
- `POST /api/posts/:postId/comments` - Create comment

### Demo Data
- 9 users (1 publisher: 海创元运营团队, 6 OPCs, 1 admin, 1 extra publisher)
- 8 demands across different categories
- 3 orders in various states (in_progress, pending_acceptance, completed)
- Portfolios and notifications seeded for OPC users

### V1.0 Limitations (by design)
- No real authentication - uses mock user (张明远, OPC user ID 2)
- No file upload for deliverables (text links only)
- No real-time notifications (poll-based)

### RBAC Multi-Admin System (v2)

- **Super admin**: `isSuperAdmin=true` in `usersTable`; gets `adminPermissions=["*"]` bypassing all checks
- **Roles table**: `admin_roles` (id, name, description, permissions: string[])
- **Role assignments**: `admin_role_assignments` (userId, roleId)
- **14 permission keys**: dashboard, cockpit, users, demands, payments, orders, disputes, finance, ecosystem, training, levelcert, content, sensitivewords, settings
- **Middleware**: `requireAdmin` (loads isSuperAdmin from DB + merges role perms), `requirePermission(key)`, `requireSuperAdmin`
- **Path-based permission guard**: router.use middleware in admin.ts maps URL prefixes to permission keys
- **Admin endpoints** (super admin only): `GET/POST /api/admin/roles`, `PATCH/DELETE /api/admin/roles/:id`, `GET/POST /api/admin/admin-users`, `PATCH/DELETE /api/admin/admin-users/:id`, `GET /api/admin/admin-users/search-users`
- **Profile endpoint**: `GET /api/admin/profile` → returns isSuperAdmin + permissions[] for current session
- **Frontend**: NAV filtered by permissions; super-admin-only items (角色管理, 管理员管理) shown only to super admins; header shows 超级管理员 badge; AdminRolesPanel + AdminUsersPanel implemented

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `codegen` → `typecheck` → recursively `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` (libs first, then artifacts)
- `pnpm run codegen` — regenerates all API types and React Query hooks from `lib/api-spec/openapi.yaml` using Orval

## API Type Sync

The frontend TypeScript types and Zod validators are auto-generated from the OpenAPI spec at `lib/api-spec/openapi.yaml`. Orval produces:
- `lib/api-client-react/src/generated/` — React Query hooks and TypeScript interfaces
- `lib/api-zod/src/generated/` — Zod schemas used by the API server for validation

**Whenever `openapi.yaml` is changed**, run `pnpm run codegen` to keep types in sync. This is also run automatically as part of `pnpm run build`.

**Developer checklist for backend schema changes:**
1. Update `lib/api-spec/openapi.yaml` first (add the new field/endpoint/status)
2. Run `pnpm run codegen` to regenerate frontend types and Zod schemas
3. Update backend route code to match the new schema
4. Verify `pnpm run typecheck:libs` still passes

`lib/api-zod/src/index.ts` exports only the Zod schemas (`./generated/api`), not the raw TypeScript types (`./generated/types`), to avoid name collisions. The types folder (`generated/types/`) is still generated on disk. The codegen script uses `fix-zod-index.mjs` (in `lib/api-spec/`) to strip the conflicting re-export from the orval-generated barrel after each run.

## Key Commands

- API codegen: `pnpm run codegen` (or `pnpm --filter @workspace/api-spec run codegen`)
- DB push: `pnpm --filter @workspace/db run push`
- Seed data: `pnpm --filter @workspace/scripts run seed`
- Dev servers: Managed via Replit workflows
