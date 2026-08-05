---
name: 生产迁移经验(跨账号)
description: 2026-08 从旧 Replit 账号迁移生产数据/附件时验证过的做法与坑
---

- 附件路径:DB 只存相对路径 `/objects/uploads/<uuid>`,服务端读取时拼 `PRIVATE_OBJECT_DIR`,跨 bucket 迁移**无需改写任何 DB 路径**(已全库扫描验证 0 残留)。
- 大附件跨账号迁移:工作区上传有大小限制(~500MB zip 传不上)。可行方案是旧侧生成"签名 URL 清单"(小 JSON),新侧逐个拉取写入新 bucket(scripts/src/export-attachment-links.ts + import-attachments-from-links.ts,支持断点续传)。签名 URL 24h 有效。
- 恢复 dump 到本项目数据库:`pg_restore --clean` 会因外键依赖顺序报错;正确做法是 `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` 后普通 pg_restore(0 错误)。
- 生产库写入:Agent 工具对生产库只读;用户可从 Database 面板 → Production → Settings 拿连接串在 Shell 里 psql/pg_restore(官方支持路径)。
- **Why:** 以上均为实际迁移中踩坑后验证的结论,再次迁移或恢复备份时直接照做。
- 部署可见性为 Private 时,普通访客的 API 请求被访问墙拦截,前端可能表现为"账号或密码错误"等误导性错误;面向公众的站点发布时必须选 Public。
- 通用坑:`pkill -f`/`pgrep -f` 的模式若出现在当前 shell 命令行里会自杀本命令;需拆字符串(如 "import-att""achments")或用脚本文件间接执行。
