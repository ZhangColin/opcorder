import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { createAdmin, validateLocalTarget, validatePassword, ADMIN_EMAIL } from "../create-local-admin.mjs";
const require = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const bcrypt = require("bcryptjs");

function poolFixture({ existing = false, insertError = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id")) return { rows: existing ? [{ id: 1 }] : [] };
      if (sql.includes("INSERT INTO") && insertError) throw new Error("insert failed");
      return { rows: [] };
    },
    release() { calls.push({ sql: "RELEASE" }); },
  };
  return { calls, pool: { async connect() { return client; } } };
}

test("only the default local sample database in development is accepted", () => {
  assert.doesNotThrow(() => validateLocalTarget({
    NODE_ENV: "development", DATABASE_URL: "postgresql://local@db:5432/jiedanba_local",
  }));
  for (const env of [
    {},
    { NODE_ENV: "production", DATABASE_URL: "postgresql://local@db/jiedanba_local" },
    { NODE_ENV: "development", DATABASE_URL: "postgresql://local@rds.example/jiedanba_local" },
    { NODE_ENV: "development", DATABASE_URL: "postgresql://local@db/jiedanba_restore_123" },
    { NODE_ENV: "development", DATABASE_URL: "postgresql://local@db:1234/jiedanba_local" },
    { NODE_ENV: "development", DATABASE_URL: "postgresql://local@db/jiedanba_local?host=remote" },
  ]) assert.throws(() => validateLocalTarget(env));
});

test("password size enforced including bcrypt byte limit", () => {
  assert.throws(() => validatePassword("short"));
  assert.throws(() => validatePassword("字".repeat(25)));
  assert.doesNotThrow(() => validatePassword(randomBytes(18).toString("hex")));
});

test("creates active superadmin using a hash accepted by the existing login bcrypt", async () => {
  const { pool, calls } = poolFixture();
  const password = randomBytes(18).toString("hex");
  await createAdmin(pool, password, (value) => bcrypt.hash(value, 4));
  const insert = calls.find((c) => c.sql.includes("INSERT INTO"));
  assert.equal(insert.params[1], ADMIN_EMAIL);
  assert.notEqual(insert.params[2], password);
  assert.equal(await bcrypt.compare(password, insert.params[2]), true);
  assert.match(insert.sql, /'admin', 'active', true/);
  assert.equal(calls[0].sql, "BEGIN");
  assert.match(calls[1].sql, /pg_advisory_xact_lock/);
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("existing target account or superadmin is never overwritten", async () => {
  const { pool, calls } = poolFixture({ existing: true });
  await assert.rejects(createAdmin(pool, randomBytes(18).toString("hex"), async () => "hash"), /已有/);
  assert.equal(calls.some((c) => /INSERT|UPDATE|DELETE/.test(c.sql)), false);
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("insert failure rolls back and releases the connection", async () => {
  const { pool, calls } = poolFixture({ insertError: true });
  await assert.rejects(createAdmin(pool, randomBytes(18).toString("hex"), async () => "hash"));
  assert.equal(calls.at(-2).sql, "ROLLBACK");
  assert.equal(calls.at(-1).sql, "RELEASE");
  assert.equal(calls.some((c) => c.sql === "COMMIT"), false);
});
