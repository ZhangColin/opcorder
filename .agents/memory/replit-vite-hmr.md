---
name: Replit Vite HMR
description: Replit 代理下 Vite 开发预览的 HMR WebSocket 连接规则
---

Replit 开发预览中的 Vite HMR 应显式使用 `REPLIT_DEV_DOMAIN` 对应主机，并通过 `wss` 和外部端口 443 连接；不要让 Vite 自动猜测本地服务端口。

**Why:** 默认 HMR 会把内部 Vite 端口用于浏览器 WebSocket。页面主体可能已经显示，但连接会反复出现 “server connection lost”，懒加载页面在重连或重新转换时可能长期停在加载状态；静态生产构建不受影响。

**How to apply:** 仅在存在 Replit 开发域名时覆盖 HMR 的协议、主机和客户端端口；本地开发保持 Vite 默认行为，生产构建与 API 代理配置保持不变。