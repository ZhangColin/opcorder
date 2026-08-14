---
name: 算力计费一致性模式
description: 算力中心运行时长计费的并发一致性约定(调度器 + 路由)
---
规则:任何涉及「写账单 + 推进 last_billed_at/状态」的操作必须在同一事务内,先 SELECT ... FOR UPDATE 锁行;调度器 tick 整体在一个事务内并用 pg_try_advisory_xact_lock 保证多实例(3000/8080 同库)只有一个执行。
**Why:** 两个 API 实例共用一库,且路由 stop/delete 与调度器 tick 可并发读同一水位,曾被评审判定会重复开单;会话级 advisory lock 配连接池会锁泄漏,必须用事务级(xact)。
**How to apply:** 改动 compute 计费/状态流转时,复用 billSegment(tx,...) 并保持 FOR UPDATE + 事务模式;禁止通过通用 PATCH 暴露 status/lastBilledAt 等生命周期字段;start 需带状态前置条件防水位重置。
