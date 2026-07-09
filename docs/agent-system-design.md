# 接单吧平台智能体系统技术文档

> 版本：2026-07-09  
> 适用场景：在其他平台复刻、二次开发或对现有机制进行改进

---

## 目录

1. [系统总览](#1-系统总览)
2. [核心架构](#2-核心架构)
3. [数据库表设计](#3-数据库表设计)
4. [LLM 多供应商层](#4-llm-多供应商层)
5. [工具（Tools）定义与执行机制](#5-工具tools定义与执行机制)
6. [ReAct 主循环执行机制](#6-react-主循环执行机制)
7. [具体智能体：V2 需求分析助手（发单方）](#7-具体智能体v2-需求分析助手发单方)
8. [具体智能体：V2 运营侧 OPC 需求助手](#8-具体智能体v2-运营侧-opc-需求助手)
9. [具体智能体：无工具纯推理场景](#9-具体智能体无工具纯推理场景)
10. [前端流式接收与表单联动](#10-前端流式接收与表单联动)
11. [历史消息管理与孤立清洗](#11-历史消息管理与孤立清洗)
12. [管理员后台：Prompt 版本管理](#12-管理员后台prompt-版本管理)
13. [已知陷阱与改进建议](#13-已知陷阱与改进建议)

---

## 1. 系统总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         浏览器前端                                │
│   AgentChatPanel.tsx                                             │
│   ├── 发送消息 → POST /api/agent/demand-analysis/chat (SSE)      │
│   ├── 实时渲染 token 流                                           │
│   ├── 解析 form_suggestion_json → 填充发单表单                    │
│   ├── 解析 option_choices_json → 渲染快捷选择按钮                 │
│   └── 解析 doc_update_json → 更新需求文档（编辑模式）             │
└────────────────────────┬─────────────────────────────────────────┘
                         │ SSE (text/event-stream)
┌────────────────────────▼─────────────────────────────────────────┐
│                    API Server (Express)                           │
│   routes/agent.ts                                                │
│   ├── 1. 鉴权 & 场景权限检查                                      │
│   ├── 2. 加载 agent_configs（System Prompt）                      │
│   ├── 3. 获取/创建 agent_conversations（会话持久化）               │
│   ├── 4. 动态注入上下文块（编辑模式、关联需求、自动收尾）           │
│   ├── 5. ReAct 主循环（最多 10 轮工具调用）                        │
│   │   ├── callLLM() → 检查 tool_calls                            │
│   │   ├── executeTool() → 本地执行                                │
│   │   └── 累积 accumulated{} 工具权威值                           │
│   ├── 6. injectAccumulatedData() → 修正 form_suggestion_json      │
│   └── 7. 流式输出 + 持久化会话                                    │
└────────────────────────┬─────────────────────────────────────────┘
              ┌──────────┴──────────┐
              │                     │
   ┌──────────▼──────┐   ┌─────────▼──────────────┐
   │   PostgreSQL     │   │   LLM 供应商            │
   │  agent_configs   │   │  (DeepSeek / OpenAI 兼 │
   │  agent_convs     │   │   容接口，多备用自动切换)│
   │  llm_providers   │   └────────────────────────┘
   │  v2_client_*     │
   └──────────────────┘
```

**核心设计理念：**
- 智能体行为完全由数据库中的 `system_prompt` 驱动，运营可在后台热改 Prompt，无需重新部署
- 工具调用结果（如日期、里程碑）由服务端权威覆写，不依赖 LLM 自行生成，避免幻觉
- 会话全量持久化于数据库，支持跨页面、跨设备续聊
- 前端使用 SSE（Server-Sent Events）流式渲染，同时传输 token、工具状态、结构化 JSON

---

## 2. 核心架构

### 2.1 文件结构

```
artifacts/api-server/src/
├── routes/agent.ts          # 智能体 HTTP 路由 & ReAct 主循环（核心）
├── lib/llm.ts               # LLM 多供应商封装（callLLM / streamLLM）
└── lib/agentTools.ts        # 工具定义 schema + 本地执行逻辑

artifacts/jiedanba/src/
└── components/agent/AgentChatPanel.tsx   # 前端对话面板

lib/db/src/schema/agent.ts   # 数据库表定义（Drizzle ORM）
```

### 2.2 场景（Scene）管理

每个智能体对应一个 `scene_key`，决定它能使用哪些工具、是否需要管理员权限：

```typescript
// 无工具场景（纯推理）
const TOOL_FREE_SCENE_KEYS = new Set([
  "v2_outsource_split",      // 发包拆分助手
  "v2_admin_opc_milestone"   // 里程碑规划助手
]);

// 仅管理员可访问
const ADMIN_ONLY_SCENE_KEYS = new Set([
  "v2_outsource_split",
  "v2_admin_opc_demand",     // 运营侧 OPC 需求助手
  "v2_admin_opc_milestone"
]);

// 指定场景只开放部分工具（白名单）
const SCENE_ALLOWED_TOOLS = new Map([
  ["v2_demand_analysis", new Set([
    "get_current_time",
    "get_demand_types",
    "get_requirement_template",
    "estimate_budget",
    "perform_self_check"
  ])],
  ["v2_admin_opc_demand", new Set([
    "get_current_time",
    "get_demand_types",
    "get_requirement_template",
    "estimate_budget",
    "perform_self_check",
    "get_linked_demand_details",
    "get_opc_levels"
  ])],
]);
```

---

## 3. 数据库表设计

### 3.1 `llm_providers` — LLM 供应商配置

```sql
CREATE TABLE llm_providers (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) UNIQUE NOT NULL,   -- 内部标识，如 "deepseek"
  display_name VARCHAR(100) NOT NULL,           -- 显示名，如 "DeepSeek"
  base_url     VARCHAR(500) NOT NULL,           -- API 端点，如 "https://api.deepseek.com"
  api_key      TEXT NOT NULL,                   -- API Key（加密存储建议）
  default_model VARCHAR(100) NOT NULL,          -- 默认使用的模型名
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,  -- 主用供应商开关
  remark       TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**说明：**
- `is_active=true` 的供应商优先使用，失败后自动 fallback 到下一个
- 环境变量 `DEEPSEEK_API_KEY` 作为最终兜底，无需数据库配置

### 3.2 `agent_configs` — 智能体场景配置

```sql
CREATE TABLE agent_configs (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,           -- 智能体显示名
  scene_key    VARCHAR(50) UNIQUE NOT NULL,     -- 场景唯一标识
  system_prompt TEXT NOT NULL,                  -- 完整 System Prompt（热改不重启）
  is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,   -- 开关，关闭后返回 503
  sort_order   INTEGER NOT NULL DEFAULT 0,      -- 后台列表排序
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**已有场景 scene_key：**

| scene_key | 名称 | 权限 | 工具 |
|---|---|---|---|
| `demand_analysis` | 旧版需求分析助手 | 所有用户 | 全量 |
| `v2_demand_analysis` | V2 需求分析助手（发单方） | 所有用户 | 白名单 5 个 |
| `v2_admin_opc_demand` | 运营侧 OPC 需求助手 | 仅管理员 | 白名单 6 个 |
| `v2_outsource_split` | 发包拆分助手 | 仅管理员 | 无工具（纯推理）|
| `v2_admin_opc_milestone` | 里程碑规划助手 | 仅管理员 | 无工具（纯推理）|

### 3.3 `agent_config_prompt_versions` — Prompt 版本历史

```sql
CREATE TABLE agent_config_prompt_versions (
  id              SERIAL PRIMARY KEY,
  agent_config_id INTEGER NOT NULL REFERENCES agent_configs(id) ON DELETE CASCADE,
  system_prompt   TEXT NOT NULL,          -- 修改前的旧 Prompt 快照
  remark          VARCHAR(200),           -- 本次修改备注
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**说明：** 每次 PUT 更新 Prompt 时，自动将当前 Prompt 快照插入此表，支持历史回溯。

### 3.4 `agent_conversations` — 会话持久化

```sql
CREATE TABLE agent_conversations (
  id                     SERIAL PRIMARY KEY,
  user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  demand_id              INTEGER REFERENCES demands(id) ON DELETE SET NULL,  -- 绑定的需求
  session_key            VARCHAR(100),                -- 创建需求前的临时会话标识
  linked_client_demand_id INTEGER,                   -- 关联的客户需求（OPC 流）
  messages               JSONB NOT NULL DEFAULT '[]', -- 完整消息历史（含 tool 消息）
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**`messages` JSONB 数组结构（每条消息）：**

```jsonc
{
  "role": "user" | "assistant" | "tool" | "system",
  "content": "消息内容 或 null（assistant 纯工具调用时）",

  // 仅 assistant 有工具调用时
  "toolCalls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": { "name": "validate_timeline", "arguments": "{\"expectedDeliveryDate\":\"2026-09-01\"}" }
    }
  ],

  // 仅 role=tool 时
  "toolCallId": "call_abc123",
  "toolName": "validate_timeline",

  // DeepSeek 推理模型特有（可选）
  "reasoningContent": "...",

  "timestamp": "2026-07-09T10:00:00.000Z"
}
```

**查找策略（优先级由高到低）：**
1. 传入 `conversationId` → 按主键精确匹配
2. 传入 `demandId` → 按绑定需求查找
3. 传入 `sessionKey` → 按临时 key 查找
4. 以上均无匹配 → 创建新对话

---

## 4. LLM 多供应商层

文件：`artifacts/api-server/src/lib/llm.ts`

### 4.1 供应商加载与优先级

```typescript
async function getOrderedProviders(): Promise<ProviderEntry[]> {
  // 1. 从数据库读取所有供应商
  // 2. is_active=true 的放前面（主力）
  // 3. is_active=false 但有 api_key 的放后面（备用）
  // 4. 最后：环境变量 DEEPSEEK_API_KEY（最终兜底）
}
```

### 4.2 `callLLM` — 非流式调用（ReAct 工具调用阶段使用）

```typescript
export async function callLLM(
  messages: LLMMessage[],
  tools?: LLMTool[],
  model?: string
): Promise<LLMResponse>
```

- 依次尝试每个供应商，任一成功则返回
- 使用 OpenAI SDK，兼容所有 OpenAI 格式接口（DeepSeek、Qwen、本地 Ollama 等）
- 返回 `toolCalls`（工具调用列表）或 `content`（最终文本）

### 4.3 `streamLLM` — 流式调用（最终回复输出使用）

```typescript
export async function* streamLLM(
  messages: LLMMessage[],
  model?: string
): AsyncGenerator<string>
```

- 优先复用 `callLLM` 已生成的 `content`，避免二次请求
- 仅当第一次调用无内容时才走真正的流式请求

### 4.4 消息格式

```typescript
type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;    // role=tool 时必填
  name?: string;            // role=tool 时填工具名
  tool_calls?: ToolCall[];  // role=assistant 有工具调用时
  reasoning_content?: string; // DeepSeek R1 推理内容
};
```

---

## 5. 工具（Tools）定义与执行机制

文件：`artifacts/api-server/src/lib/agentTools.ts`

### 5.1 工具注册格式（OpenAI Function Calling 规范）

```typescript
{
  type: "function",
  function: {
    name: "工具名",
    description: "工具用途说明（告诉 LLM 何时调用此工具）",
    parameters: {
      type: "object",
      properties: {
        参数名: {
          type: "string" | "integer" | "number" | "boolean",
          enum: ["可选值1", "可选值2"],  // 枚举限制
          description: "参数说明"
        }
      },
      required: ["必填参数名"]
    }
  }
}
```

### 5.2 全部工具清单

#### 工具 1：`get_current_time`
```
用途：获取服务器精确的北京时间（UTC+8）
触发时机：用户给出期望交付日期后，调用此工具确认今天日期
输入参数：无
输出：
  { currentDate: "2026-07-09", currentTime: "14:30", timezone: "Asia/Shanghai（UTC+8）", note: "..." }
关键设计：避免 LLM 使用训练截止日期误判"今天"
```

#### 工具 2：`get_demand_types`
```
用途：获取平台当前所有需求分类（从数据库 cat_categories 实时读取）
触发时机：需要确认需求类型时
输入参数：无
输出：
  [ { value: "TK", label: "教育培训", description: "..." }, ... ]
关键设计：优先使用数据库动态分类，不硬编码
```

#### 工具 3：`get_requirement_template`
```
用途：根据需求类型获取需求文档框架（模板）
触发时机：第一阶段确认需求类型后立即调用
输入参数：
  demandType: string (enum: 分类代码或旧代码，如 "TK" 或 "education")
输出（数据库模板优先）：
  { templateSource: "db", template: "# Markdown 模板内容..." }
输出（静态兜底）：
  { sections: [ { name: "背景与目标", guide: "引导问题", required: true }, ... ] }
关键设计：
  - 数据库模板（cat_categories.doc_template）优先，支持运营自定义
  - 新分类代码（CG/SA/TK/BO/OTHER）自动映射到旧模板 key
```

**内置静态模板（5类）：**

| 类型 | 模板节 | 必填节 |
|---|---|---|
| education（教育培训）| 背景与目标、目标学员、课程内容、交付形式、时间安排、配套资料、考核认证、场地设备、验收标准 | 前5个 + 验收 |
| software（软件开发）| 背景与目标、目标用户、核心功能、运行环境、数据与安全、界面体验、验收标准、交付后维护 | 前3个 + 验收 |
| marketing（营销）| 背景与目标、目标受众、渠道平台、内容形式、核心卖点、预期效果、时间节点、品牌调性 | 前5个 + 时间节点 |
| content（内容设计）| 背景与目标、内容类型、使用场景、风格要求、文字素材、品牌规范、交付格式、修改验收 | 前3个 + 文字素材 + 格式 |
| other（其他）| 背景与目标、具体需求、目标受众、交付物、验收标准 | 前2个 + 交付物 + 验收 |

#### 工具 4：`get_skill_tags`
```
用途：获取平台技能标签列表（从 cat_tags 实时读取，静态兜底）
触发时机：根据需求内容推荐合适的技能标签
输入参数：无
输出：[ "AI课程设计", "培训体系搭建", "Python编程", ... ]
```

#### 工具 5：`get_opc_levels`
```
用途：获取 OPC 等级说明、适用范围、预算上限
触发时机：确定 OPC 等级要求时必须先调用
输入参数：无
输出：
  [
    { level: "C", name: "C级OPC", budgetCap: 3000, qualifications: "...", suitableFor: [...] },
    { level: "B", name: "B级OPC", budgetCap: 20000, ... },
    { level: "A", name: "A级OPC", budgetCap: 200000, ... },
    { level: "any", name: "不限级别", budgetCap: 200000, ... }
  ]
```

#### 工具 6：`search_opc_candidates`
```
用途：按等级/关键词搜索 OPC 候选人（需邀请模式时使用）
触发时机：运营选择邀请发布时
输入参数：
  level: "C" | "B" | "A" | "any"
  keyword?: string（按昵称/简介模糊搜索）
输出：
  { count: 5, candidates: [ { id, userId, nickname, level, title, totalOrders, avgRating } ] }
服务端逻辑：
  - JOIN opc_profiles + users
  - 按 avgRating DESC, totalOrders DESC 排序，最多返回 20 条
  - 返回中附带 instruction 提示 LLM 如何格式化展示
```

#### 工具 7：`validate_timeline`
```
用途：验证交付日期合理性，推算抢单截止日期（bidDeadline）
触发时机：用户提供期望交付日期后立即调用
输入参数：
  expectedDeliveryDate: string (YYYY-MM-DD 或中文相对表达)
  demandType: string
  complexity?: "simple" | "medium" | "complex"
执行逻辑：
  1. 解析中文相对时间："3个月" → 加3个月，"2周" → 加14天，"N天" → 加N天
  2. 计算总天数 totalDays = deliveryDate - today
  3. 不同复杂度最短工期要求：simple≥7天，medium≥14天，complex≥21天
  4. 合理时：bidDays = min(max(3, round(totalDays×0.15)), 14)
输出（合理）：
  { isReasonable: true, bidDeadline: "2026-07-20", deliveryDate: "2026-09-01", workDays: 43 }
输出（不合理）：
  { isReasonable: false, issues: ["..."], suggestedDeliveryDate: "2026-08-01" }
服务端权威性：返回值直接注入 form_suggestion_json，LLM 无法改动
```

#### 工具 8：`suggest_milestones`
```
用途：根据需求类型和时间范围，生成里程碑拆分方案
触发时机：validate_timeline 返回合理后调用
输入参数：
  demandType: string
  deliveryDate: string (来自 validate_timeline 返回值)
  bidDeadline?: string (来自 validate_timeline 返回值)
  budget?: number
输出：
  { milestones: [ { name, deadline, description, paymentRatio } ], bidDeadline, deliveryDate }
```

**各类型里程碑模板：**

| 类型 | 里程碑阶段 | 支付比例 |
|---|---|---|
| education | 课程方案设计与确认 → 培训实施交付 → 项目结项与总结验收 | 30% / 50% / 20% |
| software | 需求确认与原型设计 → 核心功能开发 → 测试优化修复 → 正式上线 | 20% / 40% / 30% / 10% |
| marketing | 策略方案设计与确认 → 内容执行与投放 → 项目总结与收尾 | 30% / 50% / 20% |
| content | 方案沟通与初稿设计 → 内容深化与修改确认 → 最终交付 | 30% / 50% / 20% |
| other | 方案设计与确认 → 项目交付与验收 | 40% / 60% |

里程碑节点日期计算：按工期比例插值，如 software 的 p1 = bidDeadline + totalDays×15%

#### 工具 9：`estimate_budget`
```
用途：根据需求类型、复杂度、工期估算参考预算区间
触发时机：给用户提供预算参考时
输入参数：
  demandType: string
  complexity: "simple" | "medium" | "complex"
  deliveryDays?: integer
  participantCount?: integer（培训类）
输出：
  { minBudget: 8000, maxBudget: 13000, basis: "按30天工期、中等复杂度估算" }
估算逻辑：
  - education: perPersonBase × count + days × 500  (人均 200/400/800 元)
  - software:  dayRate × days  (日均 1500/2500/4000 元)
  - marketing: 8000 × complexity倍数 × (days/15)
  - content:   dayRate × days  (日均 800/1500/2500 元)
  - min = round(base × 0.8 / 1000) × 1000
  - max = round(base × 1.3 / 1000) × 1000
```

#### 工具 10：`perform_self_check`
```
用途：防止无限自检循环的计数器
触发时机：每次进入自检阶段时第一个调用
输入参数：无
输出：{ round: 3, max_rounds: 10 }
服务端逻辑：
  统计 historyMessages + intermediateMessages 中 toolName="perform_self_check" 的数量
  round >= max_rounds 时，LLM 收到信号应跳过本轮自检直接推进
```

#### 工具 11：`get_linked_demand_details`（仅 admin 场景）
```
用途：获取关联客户需求的完整详情（供 OPC 流程使用）
触发时机：系统提示中存在关联需求时
输入参数：
  clientDemandId: integer
输出：
  { title, demandType, budgetMin, budgetMax, hopeDeliveryDate, detail, instruction }
服务端逻辑：
  - 从 v2_client_demands 查主记录
  - 从 v2_client_demand_versions 取最新版本详情
  - 附带 instruction 提醒 LLM：OPC 文档不得出现客户信息
```

### 5.3 工具执行上下文（ToolExecutionContext）

每次请求开始时，服务端从数据库预加载上下文，注入 `executeTool`：

```typescript
interface ToolExecutionContext {
  categories?: Array<{ id: number; code: string; name: string; description: string | null }>;
  tags?: string[];
  docTemplates?: Record<string, string>; // 分类代码 → Markdown 模板
  existingDemand?: { title, type, description, budgetMin, budgetMax, hopeDeliveryDate };
}
```

工具优先使用数据库动态数据，数据库数据缺失时降级到代码中的静态兜底数据。

---

## 6. ReAct 主循环执行机制

### 6.1 流程图

```
前端发来消息
     │
     ▼
[构建 LLM Messages]
 system_prompt + sanitizeHistory(history) + userMessage
     │
     ▼
┌────────────────────────────────┐
│  callLLM(messages, tools)      │  ← 最多循环 10 次
└────────────┬───────────────────┘
             │
     ┌───────┴───────────┐
     │                   │
  有 tool_calls?         否（最终回复）
     │                   │
     ▼                   ▼
 执行每个工具         injectAccumulatedData()
 executeTool()        → 修正 form_suggestion_json
     │                   │
     ▼                   ▼
 积累到 accumulated{}  流式输出 token
 (bidDeadline/        → sendEvent({type:"token"})
  deadline/milestones)     │
     │                     ▼
     │              persistMessages()
     │              sendEvent({type:"done"})
     │
 sendEvent({type:"tool_call", tool:"validate_timeline"})
 将 assistant+tool 消息原子性追加到 intermediateMessages
 追加到 llmMessages 继续循环
```

### 6.2 消息流类型（SSE Events）

| `type` 字段 | 含义 | 额外字段 |
|---|---|---|
| `conversation_id` | 会话 ID，第一帧立即发送 | `conversationId: number` |
| `tool_call` | 某工具正在执行（前端显示状态） | `tool: string`（工具名）|
| `token` | 文字 token 流 | `content: string` |
| `done` | 本轮结束 | `conversationId: number` |
| `error` | 错误 | `message: string` |

### 6.3 原子性保证

工具调用完成后，才将 `assistant(tool_calls) + tool(result)` 消息**一起**追加到 `intermediateMessages`：

```typescript
// ❌ 错误做法（会产生孤立消息）
intermediateMessages.push(assistantMsg);  // 假设这里崩溃了
for (const r of toolResults) {
  intermediateMessages.push(r);           // tool 结果没有保存
}

// ✅ 正确做法（全部完成后才原子性追加）
// 先执行所有工具，全部成功后：
intermediateMessages.push(assistantMsg);
for (const r of toolResultPersistedMessages) {
  intermediateMessages.push(r);
}
```

### 6.4 工具值权威覆写（injectAccumulatedData）

这是防止 LLM 日期幻觉的核心机制：

```typescript
// validate_timeline 执行后，服务端记录权威值：
accumulated.bidDeadline = toolResult.bidDeadline;  // "2026-07-20"
accumulated.deadline = toolResult.deliveryDate;    // "2026-09-01"

// suggest_milestones 执行后追加：
accumulated.milestones = toolResult.milestones;

// 最终回复输出前，覆写 LLM 生成的 form_suggestion_json：
function injectAccumulatedData(content: string): string {
  // 找到 "form_suggestion_json:" 标记
  // 提取 JSON 对象（括号配对解析，非正则）
  // parsed.bidDeadline = accumulated.bidDeadline  ← 强制覆写
  // parsed.milestones  = accumulated.milestones   ← 强制覆写
  // 返回修正后的完整 content
}
```

**为什么要这样做：** LLM 即便在推理时看到了 `validate_timeline` 的返回值，在生成 `form_suggestion_json` 时可能仍会"记错"日期（尤其在多轮对话中）。由服务端权威值覆写，完全消除该风险。

### 6.5 历史消息孤立清洗（sanitizeHistory）

```typescript
function sanitizeHistory(history: PersistedMessage[]): PersistedMessage[] {
  // Pass 1: 收集所有有对应 tool 结果的 tool_call_id
  const respondedIds = new Set<string>(...);

  // Pass 2: 找到"完整对"的 assistant 工具调用消息
  const validToolCallIds = new Set<string>(...);

  // Pass 3: 过滤
  // - assistant(tool_calls): 只保留所有 tool_call_id 均有结果的
  // - tool: 只保留 toolCallId 在 validToolCallIds 中的
  // - 其他: 全部保留
}
```

**触发场景：** 服务端在工具执行中途崩溃，`assistant(tool_calls)` 已写入但 `tool(result)` 未写入。下次请求时，如果带着这条孤立消息发给 LLM，会收到 400 错误。

---

## 7. 具体智能体：V2 需求分析助手（发单方）

**scene_key：** `v2_demand_analysis`  
**入口：** `POST /api/agent/demand-analysis/chat`（附 `sceneKey: "v2_demand_analysis"`）  
**前端组件：** `AgentChatPanel.tsx`（drawer 或 inline 模式）  
**发单页面：** `PubCreateDemand.tsx`

### 7.1 设计目标

通过多轮对话，引导发单方从"模糊想法"变成"结构化需求文档"，最终自动填充发单表单，无需发单方手动填写任何字段。

### 7.2 对话阶段设计（由 System Prompt 定义）

建议在 system_prompt 中将对话分为以下阶段：

```
阶段 0：开场 & 类型判断
  → 调用 get_demand_types 了解当前平台有哪些分类
  → 引导用户确认需求属于哪一类

阶段 1：获取需求框架
  → 确认类型后立即调用 get_requirement_template
  → 获取该类型的信息收集模块清单

阶段 2：逐模块深度脑暴
  → 按模板各节逐一提问，每次 1-2 个问题
  → 用口语化的"引导词"而非生硬的"请填写..."

阶段 3（可选）：自检
  → 调用 perform_self_check（检查是否有关键信息缺口）
  → 有缺口 → 继续追问；无缺口 → 进入阶段 4

阶段 4：时间 & 预算确认
  → 询问期望交付日期 → 调用 get_current_time → 调用 validate_timeline
  → 时间不合理 → 告知并建议合理日期
  → 调用 estimate_budget 给预算参考

阶段 5：输出结果
  → 生成完整需求文档（Markdown 格式放入 description 字段）
  → 输出 form_suggestion_json（自动填表）
  → 输出 option_choices_json（可选：提供快捷确认按钮）
```

### 7.3 两种模式

#### 新建模式（agentMode="new"）
- 从零开始引导
- system_prompt 不含当前数据
- 最终输出 `form_suggestion_json`

#### 编辑模式（agentMode="edit"）
前端额外传入 `existingDemandData`，服务端追加到 system_prompt：

```
---
【当前需求数据（编辑模式）】
标题：XXX
类型：XXX
预算区间：¥10,000 ~ ¥30,000
希望交付日期：2026-09-01

需求文档（当前版本）：
# 背景与目标
...
---
```

此时智能体的任务是**修改**而非重建，最终输出 `doc_update_json`（只更新文档，不重填表单）。

### 7.4 自动收尾机制

防止对话无限延续、用户等待过久：

```typescript
const userTurns = historyMessages.filter(m => m.role === "user").length;
const hasSuggestion = historyMessages.some(m => 
  m.role === "assistant" && m.content?.includes("form_suggestion_json:")
);

// 用户已明确要求输出
const wrapUpKeywords = ["写文档", "出文档", "差不多了", "够了", "帮我填", ...];
const isManualWrapUp = wrapUpKeywords.some(kw => message.includes(kw));

if (userTurns >= 8 && !hasSuggestion) {
  // 注入强制指令到 system_prompt 末尾
  effectiveSystemPrompt += "\n\n【系统提示】当前对话已进行多轮...本条消息末尾必须输出 form_suggestion_json";
}
if (isManualWrapUp && !hasSuggestion) {
  effectiveSystemPrompt += "\n\n【系统强制指令】用户已明确要求输出结果...禁止再追问";
}
```

### 7.5 form_suggestion_json 字段定义

```typescript
interface FormSuggestion {
  title?: string;              // 需求标题
  type?: string;               // 需求类型（education/software/marketing/content/other）
  description?: string;        // 需求文档（Markdown 格式）
  skillTags?: string[];         // 技能标签
  opcLevel?: string;           // OPC 等级要求（C/B/A/any）
  requiredTrackLevel?: string; // 赛道认证要求
  budget?: number;             // 已废弃，用 budgetMin/budgetMax
  budgetMin?: number;          // 预算下限（元）
  budgetMax?: number;          // 预算上限（元）
  isUrgent?: boolean;          // 是否紧急
  deadline?: string;           // 交付截止日期 YYYY-MM-DD（服务端权威覆写）
  bidDeadline?: string;        // 抢单截止日期 YYYY-MM-DD（服务端权威覆写）
  milestones?: Array<{         // 里程碑（服务端权威覆写）
    name: string;
    deadline: string;
    deliverableDesc: string;
  }>;
  mode?: "public" | "invited"; // 发布模式
  invitedOpcs?: Array<{        // 邀请模式下指定 OPC
    id: number;
    nickname: string;
  }>;
}
```

**注意：** `deadline`、`bidDeadline`、`milestones` 这三个字段的值，由 `injectAccumulatedData()` 强制覆写为工具返回的权威值，LLM 生成的值无效。

### 7.6 option_choices_json 字段定义

```typescript
interface OptionChoices {
  q: string;       // 问题文本（可为空字符串）
  opts: string[];  // 选项列表
  multi: boolean;  // 是否多选
}

// 示例：
// option_choices_json: {"q":"请选择培训形式","opts":["线上直播","线下授课","线上+线下混合"],"multi":false}
```

前端渲染为快捷按钮，点击后直接填入输入框并提交，减少打字量。

### 7.7 会话生命周期

```
用户打开发单页面
  │
  ├── 如果是首次访问：生成 sessionKey（随机 UUID），发送 "你好" 触发欢迎语
  │
  ├── 如果是编辑已有需求：传入 demandId，加载历史对话
  │
  ├── 对话进行中：conversationId 由第一帧 SSE 返回，后续请求带上
  │
  └── 用户点击"发布需求"后：
      POST /api/agent/demand-analysis/bind-demand
      将 conversationId 绑定到新生成的 demandId
```

---

## 8. 具体智能体：V2 运营侧 OPC 需求助手

**scene_key：** `v2_admin_opc_demand`  
**权限：** 仅管理员（`requireAdmin` 中间件）  
**工具白名单：** `get_current_time`, `get_demand_types`, `get_requirement_template`, `estimate_budget`, `perform_self_check`, `get_linked_demand_details`, `get_opc_levels`

### 8.1 场景描述

运营将平台接到的客户需求，通过 AI 辅助转化为面向 OPC 的发包需求（隐去客户信息，拆解技术要求，确定 OPC 等级要求）。

### 8.2 关联客户需求注入

前端传入 `linkedClientDemandId`，服务端在 system_prompt 末尾**提前注入**客户需求全文：

```
---
【关联客户需求（背景参考）】
以下是本次关联的客户需求完整内容，已由系统预先获取，直接使用即可，无需调用 get_linked_demand_details 工具。

标题：某政府AI培训项目
需求类型：教育培训（TK）
预算区间：¥50,000 ~ ¥80,000
希望交付日期：2026-09-30

需求详情：
# 背景
...

重要提示：新 OPC 需求文档中不得出现原客户需求的名称、客户信息等任何标识。
---
```

**设计说明：** 选择直接注入而非让 LLM 调用 `get_linked_demand_details` 工具，是因为数据在开始时就已确定，直接注入更可靠（避免 LLM 忘记调用工具或调用时机不当）。

### 8.3 OPC 等级推荐流程

```
运营输入需求预算
  → LLM 调用 get_opc_levels（查看各等级预算上限）
  → 根据预算范围推荐合适等级
  → 运营确认等级
  → 写入 form_suggestion_json.opcLevel
```

---

## 9. 具体智能体：无工具纯推理场景

**适用 scene_key：** `v2_outsource_split`（发包拆分助手）、`v2_admin_opc_milestone`（里程碑规划助手）

### 9.1 特点

- `TOOL_FREE_SCENE_KEYS` 集合中的场景，`agentTools` 传空数组 `[]`
- LLM 不会收到任何工具定义，直接基于 system_prompt 推理
- 通常结合 `agentContext` 参数：前端将当前需求详情序列化为字符串，追加到 system_prompt 末尾

### 9.2 agentContext 注入

```typescript
// 前端（milestone agent）传入：
agentContext: `
【当前需求信息】
需求标题：AI培训项目
预算：¥30,000
里程碑现状：...
`

// 服务端追加到 effectiveSystemPrompt：
if (agentContext && agentContext.trim()) {
  effectiveSystemPrompt = effectiveSystemPrompt + "\n\n" + agentContext.trim();
}
```

---

## 10. 前端流式接收与表单联动

文件：`artifacts/jiedanba/src/components/agent/AgentChatPanel.tsx`

### 10.1 SSE 接收处理

```typescript
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  
  const lines = decoder.decode(value).split("\n");
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const event = JSON.parse(line.slice(6));
    
    switch (event.type) {
      case "conversation_id":
        setConversationId(event.conversationId);
        onConversationId?.(event.conversationId);
        break;
      case "tool_call":
        // 显示 "正在调用工具：validate_timeline..."
        break;
      case "token":
        // 累积到当前消息的 content
        currentContent += event.content;
        // 实时解析（边流边解析，避免等待完整消息）
        const { text, suggestion } = parseMessage(currentContent);
        break;
      case "done":
        // 最终解析完整消息，触发表单填充
        break;
      case "error":
        // 显示错误
        break;
    }
  }
}
```

### 10.2 消息解析（parseMessage）

LLM 回复中可能包含多个结构化标记，依次提取：

```typescript
function parseMessage(content: string): {
  text: string;            // 去掉所有 JSON 块后的纯文本（渲染给用户）
  suggestion: FormSuggestion | null;
  optionChoices: OptionChoices | null;
  docUpdate: DocUpdate | null;
} {
  // 1. 提取 doc_update_json: {...}
  // 2. 提取 form_suggestion_json: {...}
  // 3. 提取 option_choices_json: {...}
  // 4. 剩余文本清洗（去掉 DeepSeek DSML 标签、裸 JSON 行等）
  // 5. 返回 { text, suggestion, optionChoices, docUpdate }
}
```

JSON 提取使用括号配对算法（非正则），可正确处理嵌套结构：

```typescript
function extractJsonObject(str: string): { json: string; end: number } | null {
  // 找第一个 {，然后按括号深度配对找到对应 }
  // 处理字符串内的转义
}
```

### 10.3 表单填充联动

```typescript
// 父组件 PubCreateDemand.tsx 传入回调
<AgentChatPanel
  onFillForm={(suggestion) => {
    // 将 suggestion 中的字段逐一设置到 react-hook-form
    if (suggestion.title) setValue("title", suggestion.title);
    if (suggestion.type) setValue("type", normalizeType(suggestion.type));
    if (suggestion.description) setValue("description", suggestion.description);
    if (suggestion.budgetMin) setValue("budgetMin", suggestion.budgetMin);
    if (suggestion.budgetMax) setValue("budgetMax", suggestion.budgetMax);
    if (suggestion.deadline) setValue("deadline", suggestion.deadline);
    if (suggestion.milestones) setValue("milestones", suggestion.milestones);
    // ...
  }}
/>
```

### 10.4 类型标准化

AI 可能返回新旧两套分类代码，前端统一标准化：

```typescript
function normalizeType(raw: string): string {
  // 新代码 → 旧代码
  if (raw.toUpperCase() === "CG") return "content";
  if (raw.toUpperCase() === "SA") return "software";
  if (raw.toUpperCase() === "TK") return "education";
  if (raw.toUpperCase() === "BO") return "marketing";
  if (raw.toUpperCase() === "OTHER") return "other";
  // 中文兜底
  if (raw.includes("教育") || raw.includes("培训")) return "education";
  // ...
  return "other";
}
```

### 10.5 AI 生成文本清洗

防止 DeepSeek 或其他模型将工具调用标签泄漏到输出：

```typescript
function stripStructuralContent(text: string): string {
  return text
    // DeepSeek DSML 工具调用标签
    .replace(/<｜｜DSML｜｜tool_calls>[\s\S]*?<\/｜｜DSML｜｜tool_calls>/g, "")
    // 标准 XML 工具调用格式
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
    // 裸 JSON 对象行（避免 form_suggestion_json 残留显示给用户）
    .replace(/^\s*\{[\s\S]*?\}\s*$/gm, "")
    .trim();
}
```

---

## 11. 历史消息管理与孤立清洗

### 11.1 消息持久化策略

- 完整消息历史（含 `tool` 消息）全部存入 `agent_conversations.messages` JSONB 字段
- 每轮对话结束后 `UPDATE agent_conversations SET messages = $newMessages`
- **前端 API 返回时只过滤出 `user` 和纯文本 `assistant` 消息**（工具消息不展示）

### 11.2 跨轮次工具结果复用

当用户在新的一轮说"帮我填表"，LLM 可能不会重新调用 `validate_timeline`，但上一轮的调用结果仍在历史中。服务端提前扫描历史：

```typescript
const accumulated: AccumulatedToolData = {};

for (const msg of historyMessages) {
  if (msg.role !== "tool" || !msg.content || !msg.toolName) continue;
  try {
    const r = JSON.parse(msg.content);
    if (msg.toolName === "validate_timeline" && r.isReasonable === true) {
      accumulated.bidDeadline = r.bidDeadline;
      accumulated.deadline = r.deliveryDate;
    }
    if (msg.toolName === "suggest_milestones") {
      accumulated.milestones = r.milestones;
    }
  } catch { /* ignore */ }
}
```

### 11.3 会话绑定时机

```
[创建需求前] sessionKey="session-xyz" → 会话创建但 demandId=null
[用户提交发单表单] → POST /demands → 返回 demandId=123
[前端] → POST /api/agent/demand-analysis/bind-demand
         { conversationId: 456, demandId: 123 }
[后端] → UPDATE agent_conversations SET demand_id=123 WHERE id=456
```

---

## 12. 管理员后台：Prompt 版本管理

### 12.1 API 接口

```
GET    /api/admin/agent-configs           # 获取所有场景配置列表
GET    /api/admin/agent-configs/:id       # 获取单个场景详情
PUT    /api/admin/agent-configs/:id       # 更新 Prompt / 开关 / 排序
GET    /api/admin/agent-configs/:id/prompt-versions  # 获取历史版本列表
POST   /api/admin/agent-configs/:id/prompt-versions/:versionId/restore  # 回滚到历史版本
```

### 12.2 更新 Prompt 时自动快照

```typescript
router.put("/admin/agent-configs/:id", requireAdmin, async (req, res) => {
  // 更新前：将当前 systemPrompt 存入版本历史
  if (systemPrompt !== undefined) {
    const [current] = await db.select().from(agentConfigsTable).where(eq(id));
    if (current) {
      await db.insert(agentConfigPromptVersionsTable).values({
        agentConfigId: id,
        systemPrompt: current.systemPrompt,  // 旧值
        remark: remark ?? null,
      });
    }
  }
  // 然后更新为新值
  await db.update(agentConfigsTable).set({ systemPrompt: newValue }).where(eq(id));
});
```

---

## 13. 已知陷阱与改进建议

### 13.1 已知陷阱

| 陷阱 | 原因 | 现有解决方案 |
|---|---|---|
| LLM 生成错误日期 | 训练数据截止日期问题 | `get_current_time` 工具 + 服务端权威覆写 |
| form_suggestion_json 中日期与工具返回不一致 | LLM 推理偏差 | `injectAccumulatedData()` 强制覆盖 |
| 重启崩溃产生孤立 tool_call | 中途异常 | `sanitizeHistory()` 每次请求前清洗 |
| 自检阶段无限循环 | LLM 一直认为信息不足 | `perform_self_check` 工具限制最多 10 轮 |
| 多轮对话 LLM 不重调工具 | 省去认为已知的工具调用 | 历史消息预扫描填充 `accumulated{}` |
| `datetime-local` 输入拒绝裸日期 | HTML input 格式要求 | `bidDeadline` 使用 `type="date"` 输入框 |
| DeepSeek 工具标签泄漏到回复 | 模型特有行为 | `stripStructuralContent()` 清洗 |

### 13.2 改进建议

**A. Prompt 热更新通知**
当运营更改 system_prompt 时，正在进行中的会话不会立即感知。可以增加版本号字段，每次请求检查版本是否变化，若变化则在回复中提示用户重开对话。

**B. 工具调用 Retry**
当 LLM 调用工具传入参数格式错误时（如日期格式 "明年3月"），目前 `executeTool` 返回 `isReasonable: false` 提示 LLM。可进一步加入解析失败时的自动重试（最多 2 次）。

**C. 向量化需求模板**
当前 `get_requirement_template` 使用硬编码分类匹配。可升级为：将历史成功需求文档向量化入库，按相似度检索最近的案例注入 Prompt，提升生成质量。

**D. 流式工具执行**
目前每个工具都是等待完成后才推进下一步。对于 `search_opc_candidates` 这类需要数据库查询的工具，可以先 `sendEvent({type:"tool_call"})` 即时通知前端，用户感知更流畅。

**E. 工具结果缓存**
`get_demand_types`、`get_skill_tags` 这类读取频繁但变化极少的工具，可以加 60 秒内存缓存，避免每次请求都查数据库。

**F. 多 Agent 编排**
当前所有场景共用同一个 ReAct 循环。对于复杂业务（如"自动将客户需求拆分成多个 OPC 子包"），可以扩展为 Multi-Agent：主 Agent 负责拆分判断，子 Agent 并行处理每个子包，最后合并结果。

**G. 防超长对话降速**
长对话（> 40 条消息）时，历史 token 数可能超出 LLM 上下文窗口。建议：
- 超过阈值时只保留最近 N 条消息（滑动窗口）
- 或在服务端摘要压缩历史（定期将早期消息压缩为一段摘要）

---

*文档生成于 2026-07-09，基于平台当前代码版本。*
