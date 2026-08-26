---
name: Replit Vite HMR
description: Replit 代理下 Vite 开发预览的 HMR WebSocket 连接规则
---

Replit 开发预览中的 Vite HMR 应显式使用 `REPLIT_DEV_DOMAIN` 对应主机，并通过 `wss` 和外部端口 443 连接；不要让 Vite 自动猜测本地服务端口。普通前端源码修改依赖 HMR，不要额外重启前端工作流。

**Why:** 默认 HMR 会把内部 Vite 端口用于浏览器 WebSocket。前端工作流即使很快恢复，代理 WebSocket 也可能需要约 20 秒重连；重启期间已发出的动态 import 可能永久挂起，让 Suspense 长期停在加载状态。静态生产构建不受影响。

**How to apply:** 仅在存在 Replit 开发域名时覆盖 HMR 的协议、主机和客户端端口；给开发环境懒加载设置一次性超时恢复。仅在 Vite 配置、依赖或启动命令变化时重启前端工作流，普通 TSX/CSS 修改不要重启。