# 接单吧 - GitHub + 双环境操作 SOP

## 环境架构

```
开发测试环境（测试 Replit 项目）
       ↓ 测试通过
    GitHub 仓库
       ↓ 手动同步
生产环境（当前 Replit 项目）
       ↓ Replit Deploy
    线上用户访问
```

| 环境 | Replit 项目 | 数据库 | 用途 |
|------|------------|--------|------|
| 生产 | 当前项目（opcorder） | 生产 DB | 线上用户访问 |
| 测试 | 新建项目（opcorder-test） | 独立测试 DB | 内部测试，7×24 可访问 |

---

## 一、首次配置（只做一次）

### 1. 把公钥加到 GitHub

在 Replit Shell 中执行：
```bash
cat ~/.ssh/id_ed25519.pub
```

复制输出的公钥，然后：
1. 打开 GitHub → Settings → SSH and GPG keys
2. 点击 **New SSH key**
3. Title 填 `replit-opcorder`，粘贴公钥，保存

### 2. 推送代码到 GitHub

```bash
bash scripts/setup-github.sh
```

### 3. 搭建测试 Replit 项目

1. 在 Replit 新建项目，选择 **Import from GitHub**，导入 `ZhangColin/opcorder`
2. 在测试项目的 **Secrets** 中配置所有环境变量（参考下方「环境变量分工」）
3. 启动测试项目，验证功能正常
4. 发布测试项目（固定测试环境 URL）

---

## 二、日常开发流程

### 在测试环境开发和测试

1. 在测试 Replit 项目中进行代码修改和调试
2. 测试通过后，从测试项目推送到 GitHub：
   ```bash
   git add .
   git commit -m "feat: 功能描述"
   git push github master
   ```

### 将 GitHub 代码同步到生产环境

在**生产 Replit 项目**的 Shell 中执行：
```bash
git pull github master
```
然后重启工作流：**Restart** 按钮或执行 `kill 1`

### 发布生产版本

在生产 Replit 项目点击 **Deploy** 按钮，等待部署完成。

---

## 三、数据库同步（生产 → 测试）

当需要用生产数据测试时，在**测试 Replit 项目**的 Shell 中执行：

```bash
TEST_DATABASE_URL="postgresql://..." ./scripts/sync-prod-to-test.sh
```

或者直接传参：
```bash
./scripts/sync-prod-to-test.sh "postgresql://user:pass@host/testdb"
```

**注意事项：**
- 此操作会**完全覆盖**测试数据库，脚本会二次确认
- 建议在正式测试前或发现 bug 后执行，保持测试数据与生产一致
- 生产数据库地址（`DATABASE_URL`）由 Replit 环境变量自动提供，无需手动填写

---

## 四、环境变量分工

| 变量名 | 生产环境 | 测试环境 | 说明 |
|--------|---------|---------|------|
| `DATABASE_URL` | 生产 DB 地址 | 测试 DB 地址 | **各自独立** |
| `JWT_SECRET` | 独立密钥 | 独立密钥 | **各自独立**，防止 token 互通 |
| `OPENAI_API_KEY` | 生产 key | 同一个或测试 key | 可共用，注意费用 |
| `RESEND_API_KEY` | 生产 key | 同一个 | 可共用，测试时邮件会真实发送 |
| `GCS_BUCKET_NAME` | 生产存储桶 | 独立测试存储桶 | **建议独立**，防止污染生产文件 |
| `NODE_ENV` | `production` | `development` | 各自设置 |

---

## 五、回滚操作

### 代码回滚
```bash
# 查看提交历史
git log --oneline -10

# 回滚到指定版本（在生产项目 Shell 中）
git checkout <commit-hash> -- .
git commit -m "rollback: 回退到 <commit-hash>"
git push github master
```

### 数据库回滚
使用 `backups/` 目录中的每日备份：
```bash
# 查看可用备份
ls backups/

# 恢复备份（替换为实际文件名）
psql "$DATABASE_URL" < backups/backup_YYYYMMDD.sql
```
