// Called by create-local-admin.sh; never supplies or resets a default password.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export const ADMIN_EMAIL = "admin@jiedanba.com";

export function validateLocalTarget(env) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error("缺少有效的本地DATABASE_URL。"); }
  if (env.NODE_ENV !== "development" ||
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.hostname !== "db" || (url.port && url.port !== "5432") ||
      url.pathname !== "/jiedanba_local" || url.search) {
    throw new Error("仅允许development环境的db:5432/jiedanba_local；拒绝生产和恢复库。");
  }
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("密码至少12个字符，UTF-8长度不超过72字节。");
  }
}

async function ensureMissing(client) {
  const { rows } = await client.query(
    "SELECT id FROM users WHERE lower(email) = $1 OR is_super_admin = true LIMIT 1",
    [ADMIN_EMAIL],
  );
  if (rows.length) {
    throw new Error("本地库已有该账号或超级管理员，未修改任何账号。请先核对已有账号的登录状态，不重复创建或重置。");
  }
}

export async function createAdmin(pool, password, hashPassword) {
  validatePassword(password);
  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('jiedanba-local-admin-bootstrap'))");
    await ensureMissing(client);
    await client.query(
      `INSERT INTO users (nickname, email, password_hash, role, status, is_super_admin)
       VALUES ($1, $2, $3, 'admin', 'active', true)`,
      ["本地系统管理员", ADMIN_EMAIL, hash],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  validateLocalTarget(process.env);
  const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
  const { Pool } = require("pg");
  const bcrypt = require("bcryptjs");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  try {
    if (process.argv[2] === "--check") {
      await ensureMissing(pool);
      console.log("本地样例库检查通过，可以创建首个系统管理员。");
      return;
    }
    if (process.argv[2] !== "--create") throw new Error("请通过create-local-admin.sh执行。");
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > 1024) throw new Error("密码输入过长。");
      chunks.push(chunk);
    }
    const password = Buffer.concat(chunks).toString("utf8");
    await createAdmin(pool, password, (value) => bcrypt.hash(value, 12));
    console.log(`已创建本地系统管理员：${ADMIN_EMAIL}。使用你刚设置的密码登录，不需要重启API。`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Avoid database error details, SQL parameters, password or connection URL.
    const known = /^(缺少有效|仅允许|密码至少|本地库已有|请通过|密码输入过长)/;
    console.error(known.test(error.message)
      ? error.message
      : "创建失败：请确认本地dev/db已运行、users表已初始化且包含is_super_admin字段。未覆盖已有账号。");
    process.exitCode = 1;
  });
}
