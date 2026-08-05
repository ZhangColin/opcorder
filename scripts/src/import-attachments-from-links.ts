/**
 * import-attachments-from-links.ts — 在【新项目】运行。
 * 读取 attachments-links.json,直接从签名 URL 拉取每个文件写入新 bucket,
 * 并恢复 contentType 和自定义元数据(custom:aclPolicy)。
 *
 * 用法:
 *   pnpm --filter @workspace/scripts exec tsx ./src/import-attachments-from-links.ts ../attachments-links.json
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const SIDECAR = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

interface LinkEntry {
  group: string;
  relPath: string;
  contentType?: string;
  customMetadata?: Record<string, string>;
  size: number;
  signedUrl: string;
}

function parsePath(p: string): { bucket: string; prefix: string } {
  const parts = p.replace(/^\/+/, "").split("/");
  return { bucket: parts[0]!, prefix: parts.slice(1).join("/") };
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) throw new Error("用法: tsx ./src/import-attachments-from-links.ts <attachments-links.json>");

  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const publicPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const entries: LinkEntry[] = JSON.parse(readFileSync(jsonPath, "utf8"));

  function targetFor(group: string): string {
    if (group === "private") {
      if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR 未设置");
      return privateDir;
    }
    const idx = Number(group.split(":")[1]);
    const p = publicPaths[idx] ?? publicPaths[0];
    if (!p) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS 未设置");
    return p;
  }

  function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} 超时(${ms}ms)`)), ms)),
    ]);
  }

  // 一次性列出目标 bucket 中已存在的对象(断点续传加速)
  const existingSizes = new Map<string, number>();
  const seen = new Set<string>();
  for (const e of entries) {
    const base = targetFor(e.group);
    if (seen.has(base)) continue;
    seen.add(base);
    const { bucket, prefix } = parsePath(base);
    const cleanPrefix = prefix ? prefix.replace(/\/+$/, "") + "/" : "";
    const [files] = await storage.bucket(bucket).getFiles({ prefix: cleanPrefix });
    for (const f of files) existingSizes.set(`${bucket}/${f.name}`, Number(f.metadata.size || 0));
  }
  console.log(`目标 bucket 已有 ${existingSizes.size} 个对象`);

  let ok = 0;
  const failed: string[] = [];
  for (const e of entries) {
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    try {
      const base = targetFor(e.group);
      const { bucket, prefix } = parsePath(base);
      const objectName = (prefix ? prefix.replace(/\/+$/, "") + "/" : "") + e.relPath;
      // 断点续传:已存在且大小一致则跳过
      if (existingSizes.get(`${bucket}/${objectName}`) === e.size) {
        ok++;
        done = true;
        continue;
      }
      const res = await fetch(e.signedUrl, { signal: AbortSignal.timeout(120000) });
      if (!res.ok || !res.body) throw new Error(`下载失败 HTTP ${res.status}`);
      const file = storage.bucket(bucket).file(objectName);
      await withTimeout(
        pipeline(
          Readable.fromWeb(res.body as import("stream/web").ReadableStream),
          file.createWriteStream({
            contentType: e.contentType,
            resumable: false,
            metadata: { metadata: e.customMetadata },
          }),
        ),
        180000,
        "上传",
      );
      ok++;
      done = true;
      console.log(`✓ [${ok}/${entries.length}] ${e.relPath} (${(e.size / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`  重试 ${attempt}/3 失败 ${e.relPath}: ${err}`);
      if (attempt === 3) failed.push(e.relPath);
      else await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
    }
  }
  console.log(`\n导入完成: 成功 ${ok}/${entries.length}` + (failed.length ? `,失败: ${failed.join(", ")}` : ""));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
