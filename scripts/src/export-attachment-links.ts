/**
 * export-attachment-links.ts — 在【旧项目】运行。
 * 不下载文件,只为每个附件生成 24 小时有效的签名下载 URL,
 * 输出一个很小的 attachments-links.json,便于传到新项目。
 *
 * 用法(旧项目 Shell):
 *   pnpm --filter @workspace/scripts exec tsx ./src/export-attachment-links.ts
 */
import { Storage } from "@google-cloud/storage";
import { writeFileSync } from "fs";

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

async function signGetURL(bucketName: string, objectName: string, ttlSec: number): Promise<string> {
  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "GET",
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`签名失败: ${res.status}`);
  const { signed_url } = (await res.json()) as { signed_url: string };
  return signed_url;
}

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
  const TTL = 24 * 3600; // 24 小时
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const publicPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!privateDir && publicPaths.length === 0) {
    throw new Error("PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS 均未设置");
  }

  const groups: Array<{ name: string; path: string }> = [];
  if (privateDir) groups.push({ name: "private", path: privateDir });
  publicPaths.forEach((p, i) => groups.push({ name: `public:${i}`, path: p }));

  const entries: LinkEntry[] = [];
  let bytes = 0;

  for (const g of groups) {
    const { bucket, prefix } = parsePath(g.path);
    const cleanPrefix = prefix ? (prefix.endsWith("/") ? prefix : prefix + "/") : "";
    console.log(`[扫描] 组 ${g.name}: bucket=${bucket} prefix=${cleanPrefix || "(根)"}`);
    const [files] = await storage.bucket(bucket).getFiles({ prefix: cleanPrefix });
    for (const f of files) {
      const relPath = f.name.slice(cleanPrefix.length);
      if (!relPath || relPath.endsWith("/")) continue;
      if (relPath.startsWith("pending/")) continue;
      const [meta] = await f.getMetadata();
      const signedUrl = await signGetURL(bucket, f.name, TTL);
      entries.push({
        group: g.name,
        relPath,
        contentType: (meta.contentType as string) || undefined,
        customMetadata: (meta.metadata as Record<string, string>) || undefined,
        size: Number(meta.size || 0),
        signedUrl,
      });
      bytes += Number(meta.size || 0);
      console.log(`  ✓ ${relPath} (${meta.size} bytes)`);
    }
  }

  writeFileSync("attachments-links.json", JSON.stringify(entries, null, 1));
  console.log(
    `\n共 ${entries.length} 个文件, 约 ${(bytes / 1024 / 1024).toFixed(1)} MB。` +
      `\n已生成 attachments-links.json(链接 24 小时内有效),在文件树中下载它并上传到新项目。`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
