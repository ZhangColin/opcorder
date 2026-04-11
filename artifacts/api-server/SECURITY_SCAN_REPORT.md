# 安全扫描报告

**扫描日期**: 2026-04-11  
**扫描范围**: 依赖漏洞审计（osv-scanner） + SAST 静态分析（Semgrep） + 数据流扫描（HoundDog）

> 本报告仅列出新发现的问题，不做自动修复，等待人工评审后决策。

---

## 本次修复内容（已合并）

| 问题 | 修复措施 | 状态 |
|------|---------|------|
| `X-Powered-By: Express` 泄露后端框架 | `app.disable("x-powered-by")` + Helmet hidePoweredBy 双重保障 | ✅ 已修复 |
| `X-Cloud-Trace-Context` 泄露 GCP 追踪 ID | 请求中间件（路由处理前）调用 `res.removeHeader("X-Cloud-Trace-Context")` 剥离 | ✅ 已修复（应用层） |
| `Server: Google Frontend` 泄露托管平台 | 请求中间件调用 `res.removeHeader("Server")` 尽力屏蔽 | ⚠️ 见下方注意 |
| Express 默认纯文本错误 `Cannot POST ...` | 确认 catch-all JSON 404 中间件已覆盖全部 HTTP 方法 | ✅ 已确认有效 |

**已知限制**：
- `Server: Google Frontend`：由 Google Cloud 负载均衡器（GFE）在网络基础设施层注入，应用层响应发出后 GFE 可能在转发阶段重新覆盖此头部，代码层无法彻底消除。彻底消除需在 Cloud Run / GCP 侧配置响应头重写规则。
- `X-Cloud-Trace-Context`：通常由 GCP Cloud Trace 代理在基础设施层注入，在部署环境中应用层移除可能被覆盖。若生产环境中该头部仍出现，需在 Cloud Run 或 GCP 负载均衡器层配置头部屏蔽策略。

---

## 依赖漏洞审计（共 17 项）

按严重程度排序，**不自动修复**。

### HIGH（9 项）

| 包名 | 当前版本 | 修复版本 | 问题描述 |
|------|---------|---------|---------|
| `basic-ftp` | 5.2.0 | 5.2.2 | FTP 命令注入：CRLF 注入防护不完整，凭证和 MKD 命令路径均可被注入任意 FTP 命令（CVE-2026-39983 等） |
| `basic-ftp` | 5.2.0 | 5.2.1 | FTP 命令注入：`protectWhitespace()` 未过滤 `\r\n`，高级路径 API 均受影响 |
| `drizzle-orm` | 0.45.1 | 0.45.2 | SQL 注入：SQL 标识符转义不当 |
| `lodash` | 4.17.23 | 4.18.0 | 代码注入：`_.template` imports 键名未正确过滤 |
| `path-to-regexp` | 8.3.0 | 8.4.0 | ReDoS：连续可选分组导致正则拒绝服务 |
| `picomatch` | 2.3.1 | 2.3.2 | ReDoS：extglob 量词导致灾难性回溯 |
| `picomatch` | 4.0.3 | 4.0.4 | ReDoS：同上 |
| `vite` | 7.3.1 | 7.3.2 | 任意文件读取：Vite 开发服务器 WebSocket 可被滥用读取任意文件 |
| `vite` | 7.3.1 | 7.3.2 | 路径穿越：`server.fs.deny` 可被查询参数绕过 |

### MODERATE（7 项）

| 包名 | 当前版本 | 修复版本 | 问题描述 |
|------|---------|---------|---------|
| `brace-expansion` | 2.0.2 | 2.0.3 | 零步序列导致进程挂起和内存耗尽（DoS） |
| `lodash` | 4.17.23 | 4.18.0 | 原型污染：`_.unset` 数组路径绕过 |
| `path-to-regexp` | 8.3.0 | 8.4.0 | ReDoS：多个通配符组合导致正则拒绝服务 |
| `picomatch` | 2.3.1 | 2.3.2 | 方法注入：POSIX 字符类导致 glob 匹配错误 |
| `picomatch` | 4.0.3 | 4.0.4 | 方法注入：同上 |
| `vite` | 7.3.1 | 7.3.2 | 路径穿越：优化依赖 `.map` 文件处理中的路径穿越 |
| `yaml` | 2.8.2 | 2.8.3 | 栈溢出：深层嵌套 YAML 集合导致解析器崩溃（DoS） |

### LOW（1 项）

| 包名 | 当前版本 | 修复版本 | 问题描述 |
|------|---------|---------|---------|
| `@tootallnate/once` | 2.0.0 | 3.0.1（大版本升级） | 控制流泄露：AbortSignal 触发后 Promise 永久挂起导致请求停滞 |

---

## SAST 静态分析（共 30 项）

### HIGH（10 项）

**文件**: `artifacts/api-server/seed.sql`

- 检测到 bcrypt 哈希字符串：数据库种子文件中包含测试用户的密码哈希值
- **评估**：这是开发/演示数据库种子文件，哈希值为测试密码，非生产凭证。如 seed.sql 不纳入版本控制或不用于生产环境初始化，风险可接受。建议从版本控制中排除该文件（加入 `.gitignore`），或删除哈希值改用占位符。

### MEDIUM（3 项）

**文件**: `artifacts/api-server/src/routes/auth.ts` — HTML 模板字符串 XSS 风险

- `forgot-password` 邮件模板中，`user.nickname` 直接插值到 HTML 字符串中（未经 `escapeHtml` 处理）
- `buildWelcomeEmail` 函数中的部分 `escapeHtml` 调用可能存在遗漏场景
- **评估**：nickname 来自注册时用户输入，若含 HTML 标签可能在邮件客户端中被渲染。建议对 `forgot-password` 模板中所有用户数据应用 `escapeHtml`。

**文件**: `artifacts/mockup-sandbox/src/App.tsx`

- 动态方法调用：通过非静态数据从对象获取并执行方法，若数据来自用户输入可能执行任意代码
- **评估**：mockup-sandbox 为内部开发组件预览工具，非生产对外服务，当前风险较低。

### MEDIUM（16 项）

**文件**: `attached_assets/*.html`

- 外部脚本/样式标签缺少 `integrity` 属性（子资源完整性 SRI）
- **评估**：`attached_assets/` 为静态设计草稿资产，不属于部署产物，无实际安全风险。

---

## 数据流扫描（HoundDog）

**发现数量**: 0  
无隐私数据泄露或敏感数据流问题。

---

## 建议优先级

| 优先级 | 操作 |
|------|------|
| P0（高优先，尽快） | 升级 `drizzle-orm` 至 0.45.2（SQL 注入，直接影响生产数据库） |
| P1（较高优先） | 升级 `basic-ftp` 至 5.2.2（FTP 命令注入，若项目使用 FTP 功能） |
| P1（较高优先） | 升级 `vite` 至 7.3.2（开发服务器文件读取漏洞，影响开发环境安全） |
| P2（中优先） | 修复 `auth.ts` forgot-password 模板中的 XSS 风险（为 nickname 添加 escapeHtml） |
| P2（中优先） | 升级 `path-to-regexp`、`yaml`、`brace-expansion`（DoS 风险） |
| P3（低优先） | 将 `seed.sql` 加入 `.gitignore`，移除硬编码哈希 |
| P3（低优先） | 升级 `lodash`、`picomatch`（间接依赖，影响较小） |
