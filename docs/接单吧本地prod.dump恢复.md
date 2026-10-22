# 从现有 prod.dump 恢复到本地Docker数据库

本节用于**已有备份的本地开发**，不是向阿里云RDS恢复，也不需要再次连接Replit生产库。先完成主手册步骤07；已经跑起来的系统不必重装。

恢复策略：**每次固定恢复到`jiedanba_local`，先备份原本地库，再删除并重建这个库。现有本地数据将被备份内容替换。** 不再创建带时间戳的恢复库，不需每次改连接配置。脚本不修改`api.env`、不启动API，不自动执行结构同步、迁移或seed。数据库备份不包含OSS/MinIO附件文件。

## 1. 准备备份与脚本

1. 把现有`prod.dump`复制到源码目录中的`local-dev/prod.dump`。不要发到聊天、提交Git或传到公开文件空间；备份可能含用户个人信息、密码哈希、刷新令牌及供应商配置。
2. 本次新增的脚本在仓库 **`scripts/restore-prod-dump-local.sh`**。如果你本地是之前下载的源码，**只复制这个脚本到本地同名位置**，不要重新下载整包覆盖正在修改的源码。
3. `.gitignore`应包含`/local-dev/`和`*.dump`；当前仓库已补齐。旧下载版需自行补这两行；若备份早已被Git跟踪，忽略规则不会移除历史，先检查是否泄露，不能只添加忽略规则了事。
4. 本机Docker使用本地Desktop环境，`db`容器应为healthy。脚本拒绝远程Docker连接，只通过名为`jiedanba-local`的Compose项目进入本地`db`，不使用`DATABASE_URL`连接任何外部服务器。

**支持格式：** `pg_dump -Fc`自定义归档或`pg_dump -Ft`的单文件tar归档，以`pg_restore --list`可读取为准。`.dump`只是扩展名，不能判断格式。普通SQL文本、压缩包、目录格式备份不能直接用此脚本；不要仅重命名文件，也不要盲目改用`psql`执行整份未知SQL。

只处理来源可信且你有权限使用的备份。还原操作会执行备份内的SQL，不能处理来历不明的归档。

## 2. 执行恢复

**在哪里：本地终端，源码根目录或`local-dev`均可。**

**使用当前普通用户执行，不加`sudo`，不直接执行`.sh`文件。** 本文通过`bash 脚本路径`运行，不要求脚本有可执行权限。`sudo`可能切换Docker上下文、生成root所属文件，不能用来解决路径错误。它提示的`Password:`是操作系统密码，不是数据库密码。

如果你已经在`local-dev`，可直接使用：

```bash
ls -l ../scripts/restore-prod-dump-local.sh &&
bash ../scripts/restore-prod-dump-local.sh
```

如果第一条提示文件不存在，停止重试，按第1节把新增脚本复制到本地`源码根目录/scripts/restore-prod-dump-local.sh`，确认文件名没有额外`.txt`后缀。在错误目录也会找不到文件，可先用`pwd`查看当前位置。不要为此重新下载整个项目覆盖本地修改。

**旧版脚本出现`SOURCE_MAJOR…: unbound variable`：** 这是变量后直接拼中文导致的Bash解析兼容问题，当前脚本已将这些位置改为`${SOURCE_MAJOR}`、`${SERVER_MAJOR}`和`${file}`。将仓库里的最新`restore-prod-dump-local.sh`完整覆盖到本地同名文件后重试，不改dump文件或数据库。若报错仍在第1步版本提示处，尚未暂停应用、建库或执行恢复；不要关闭`set -u`掩盖错误。

如果此前用`sudo`运行，报告目录可能属于root。仅当普通用户重试出现`restore-reports`权限不足时，在**`local-dev`目录**执行下面命令，把这个生成目录归还当前用户；保留其中备份和报告，不删除数据，不对整个项目或Docker卷递归改权限：

```bash
if [ -d ./restore-reports ] && [ ! -L ./restore-reports ]; then
  sudo chown -R "$(id -u):$(id -g)" ./restore-reports
fi
bash ../scripts/restore-prod-dump-local.sh
```

这里的`sudo`仅用于修复旧报告目录的所有权，**不是**用于执行恢复脚本。

保留正在运行的终端也可以；脚本在你确认后会停止本地`dev`和`nginx`，API与前端随之退出，页面暂时不能访问。`db`、MinIO、Mailpit继续运行。

不确定当前是源码根目录还是`local-dev`时，复制下面的完整命令（与上面的直接执行方式二选一，不要重复恢复）：

```bash
(
set -e
if [ -f package.json ] && [ -d local-dev ]; then
  :
elif [ "$(basename "$PWD")" = local-dev ] && [ -f ../package.json ]; then
  cd ..
else
  echo '请在源码根目录或local-dev执行。' >&2
  exit 1
fi
if [ ! -f scripts/restore-prod-dump-local.sh ]; then
  echo '缺少恢复脚本：请先把仓库新增文件复制到本地scripts/restore-prod-dump-local.sh。' >&2
  exit 1
fi
bash scripts/restore-prod-dump-local.sh
)
```

如果备份在其他路径，在源码根目录运行：

```bash
bash scripts/restore-prod-dump-local.sh "/你的备份目录/prod.dump"
```

脚本会先检查格式、源库版本与本地版本，然后要求输入 **`RESTORE_LOCAL`**。只有输入完全一致才会暂停应用、备份并覆盖本地库。请先关闭数据库客户端中对本地库的编辑操作；重建会断开该库现有连接。

脚本依次做：

1. 在容器内运行`pg_restore --list`，把清单保存到本地报告目录。源PostgreSQL主版本高于本地版本则停止，不尝试降级恢复。
2. 停止本地应用，把原`jiedanba_local`（若存在）备份为独立dump并检查归档可读。备份失败立即停止，不删除原库。
3. 仅删除并重建本地Docker内的`jiedanba_local`；其他库和Docker数据卷不删除。
4. 用`--single-transaction --exit-on-error --no-owner --no-privileges`完整恢复；源角色不必搬到本地，对象归本地数据库用户所有，原生产权限不作为本地权限复刻。
5. 检查有应用表，导出逐表计数、序列状态及扩展列表，执行`ANALYZE`。
6. 输出固定数据库名`jiedanba_local`和`local-dev/restore-reports/...`报告目录，随后按第4节启动前后端。

备份文件需留出“原备份 + 原本地库备份 + 新恢复库”的磁盘空间。较大的备份恢复可能持续一段时间；不要因为没有逐行输出就重复执行。标准输出写入报告，出错即停。

## 3. 检查恢复结果

打开脚本输出的报告目录：

| 文件 | 用途 |
|---|---|
| `archive.list` | 源数据库版本、备份工具版本、表/索引/约束/序列等归档目录 |
| `before-jiedanba_local.dump` | 默认原本地库备份；原库不存在时没有此文件 |
| `restore.log` | 恢复日志；不能有未处理错误 |
| `checks.txt` | 新库版本、逐表行数、序列及扩展列表 |
| `database-name.txt` | 恢复成功后记录固定数据库名jiedanba_local |

“脚本恢复成功”表示SQL恢复和基础检查完成，**不是与生产逐笔对账完成**。至少检查用户、订单、合同、余额/账单、`schema_migrations`等关键表是否存在，与备份时已有的统计对比。若没有源统计，就如实记录“未完成源目标计数对账”，不能承诺零丢失。还原后的金额、时间、密码哈希保持原值，不批量重置密码或改时区。

若提示缺扩展/不支持的版本：

- 读取报告中的第一条实际错误，先解决兼容性；不要删去失败对象来凑“成功”。
- 本地PostgreSQL容器不一定包含源库的所有扩展。需要安装匹配扩展时另做兼容镜像；不能把已有17版数据卷直接挂到其他主版本镜像。
- `pg_restore`工具过旧时应使用兼容的客户端和目标库；脚本默认使用当前db容器工具。它会明确失败，不自动升级数据库。

## 4. 启动本地系统

**这一步不能只靠把连接串改成本地。** dump里仍可能包含真实的邮件/短信配置、模型密钥、支付订单、回调地址、上传链接和定时任务状态。

启动前确认：

- `api.env`继续使用本地JWT密钥、本地域名、MinIO测试桶和Mailpit，不复制生产Secrets。旧生产登录token不应在本地继续有效；重新登录。
- 主手册4.2的任务开关已经在代码中实现并验证。仅写`DISABLE_SCHEDULER=true`并不能让原代码自动关闭任务。
- 已实现的邮件适配确实指向Mailpit；短信、支付、退款、签章、AI调用使用沙箱或禁用真实外发。数据库动态配置也必须审查，不能只检查环境文件。
- 不随意点击恢复订单的付款、退款、签章或通知按钮；未经核验的真实用户数据只能在授权范围内查看和处理。脱敏以新恢复库为对象，保留原dump不改。
- 启动API会执行原`runMigrations`和`runSeed`，可能补数据或更新配置。先检查代码与备份版本差异，再允许启动；不删除`schema_migrations`，不永久跳过原更新机制。

如果这些隔离尚未完成，先处理本地配置和任务外发，再启动应用；不要连接真实供应商试付生产订单。

完成隔离后，用编辑器打开`local-dev/api.env`，找到：

```dotenv
DATABASE_URL=postgresql://jiedanba:你的本地数据库密码@db:5432/jiedanba_local
```

上面只是定位示意，**不要复制替换用户名、密码**。数据库名始终是`jiedanba_local`，主机始终是本地`db`。如果之前按旧文档改成了`jiedanba_restore_*`，仅这一次改回`jiedanba_local`；以后恢复不再改配置。

根据源码和备份的版本选择：

- **同版本，仅查看恢复数据：**不为打开页面重复运行`build:prod`，直接执行下面的完整启动步骤。API启动仍会运行原迁移和seed。
- **代码包含新的数据库变更：**先按主手册第12节在此新恢复库上演练原更新流程。`push-force`可能修改/删除结构，不能把它当作只读检查。

### 恢复成功后，让本地页面使用恢复的数据

恢复成功后`jiedanba_local`已经是备份中的数据，不需要再导入或切库。按以下顺序操作：

1. 首次核对`api.env`连接本地`db:5432/jiedanba_local`；以后的恢复跳过此项。不要修改`.env`中的`POSTGRES_DB`。
2. 在**终端一**执行下面整段，可从源码根目录或`local-dev`开始。恢复脚本停止了`dev`，前后端都在里面；`exec`不会自动启动容器，必须先`up`。如果修改过环境文件，重建才能加载新值。最后一条持续运行是正常现象。

```bash
(
set -e
if [ -f package.json ] && [ -d local-dev ]; then
  cd local-dev
elif [ "$(basename "$PWD")" = local-dev ] && [ -f ../package.json ]; then
  :
else
  echo '请在源码根目录或local-dev执行。' >&2
  exit 1
fi
docker compose -f compose.yaml --env-file .env up -d --force-recreate dev
docker compose -f compose.yaml --env-file .env ps
docker compose -f compose.yaml --env-file .env exec dev pnpm --filter @workspace/api-server run dev
)
```

3. 保持终端一运行，在**终端二**执行整段启动前端，同样自动识别目录：

```bash
(
set -e
if [ -f package.json ] && [ -d local-dev ]; then
  cd local-dev
elif [ "$(basename "$PWD")" = local-dev ] && [ -f ../package.json ]; then
  :
else
  echo '请在源码根目录或local-dev执行。' >&2
  exit 1
fi
docker compose -f compose.yaml --env-file .env exec \
  -e PORT=5173 -e BASE_PATH=/ -e API_PROXY_TARGET=http://127.0.0.1:3000 \
  dev pnpm --filter @workspace/jiedanba run dev --strictPort
)
```

4. 出现API监听日志和Vite ready后，访问`http://localhost:5173`，退出旧登录并重新登录。此时应使用**备份库中的账号与密码**，不是之前本地空库创建的账号。核对一条已知历史订单或记录，确认页面读取到了恢复数据。

以上启动命令不加`sudo`。恢复脚本已替换原本地库数据，旧数据备份在报告目录。数据库恢复不能补回对象文件；如列表正常但附件打不开，继续第5节，不要重新恢复数据库。

## 5. 附件与地址

`prod.dump`只有数据库对象和数据，不包含Replit对象存储中的实际文件。记录恢复后，头像、附件、合同预览等仍可能打不开，不能因此直接判断数据库恢复失败。

需要在本地看附件时，按主手册第9节复制获准使用的对象到本地私有MinIO桶，保留业务相对路径、Content-Type和权限；仅针对新恢复库审查旧绝对域名和过期签名URL。不要为测试将私有桶设为公开，也不要修改原生产对象。

## 6. 失败与回退

- 预检查或确认前取消：未停止应用、未创建数据库，处理提示后重试。
- 备份失败：不删除原本地库，应用保持停止；处理磁盘空间或报错后再执行。
- 删除重建后恢复失败：原库已被替换，应用保持停止。恢复使用单事务，但**事务不包含前面的删库**，不能承诺自动回到旧数据。解决兼容问题后可重跑原dump。
- 如需恢复操作前的本地数据，在`local-dev`执行下列命令，将路径替换为本次报告目录中的原库备份。仍只恢复到`jiedanba_local`，不改配置；不要误选失败重试后产生的空库备份。

```bash
bash ../scripts/restore-prod-dump-local.sh \
  "./restore-reports/本次报告目录/before-jiedanba_local.dump"
```

- 原库不存在时没有`before-jiedanba_local.dump`。其他旧版`jiedanba_restore_*`库不受影响，本脚本不清理它们。
- 原dump、备份和报告是敏感文件，按公司期限保留。脚本不会删除Docker数据卷。
