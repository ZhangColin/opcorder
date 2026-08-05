/**
 * export-attachments.ts — 在【旧项目】运行,导出对象存储中的全部附件。
 *
 * 用法(旧项目 Shell):
 *   pnpm --filter @workspace/scripts exec tsx ./src/export-attachments.ts
 *
 * 依赖环境变量(旧项目已配置):
 *   PRIVATE_OBJECT_DIR            例: /replit-objstore-xxxx/.private
 *   PUBLIC_OBJECT_SEARCH_PATHS    例: /replit-objstore-xxxx/public
 *
 * 输出:
 *   ./attachments-export/manifest.json   清单(相对路径 + contentType + 自定义元数据)
 *   ./attachments-export/files/...       所有对象文件
 *   ./attachments-export.tar.gz          打包结果(下载这个文件)
 */
import { Storage } from "@google-cloud/storage";
import { createWriteStream, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { pipeline } from "stream/promises";
import { execSync } from "child_process";

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

interface ManifestEntry {
  group: string; // "private" 或 "public:<n>"
  relPath: string; // 相对于该组根目录的路径
  contentType?: string;
  customMetadata?: Record<string, string>;
}

function parsePath(p: string): { bucket: string; prefix: string } {
  const parts = p.replace(/^\/+/, "").split("/");
  return { bucket: parts[0]!, prefix: parts.slice(1).join("/") };
}

async function main() {
  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const publicPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!privateDir && publicPaths.length === 0) {
    throw new Error("PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS 均未设置");
  }

  const outRoot = resolve("./attachments-export");
  const filesRoot = join(outRoot, "files");
  mkdirSync(filesRoot, { recursive: true });

  const groups: Array<{ name: string; path: string }> = [];
  if (privateDir) groups.push({ name: "private", path: privateDir });
  publicPaths.forEach((p, i) => groups.push({ name: `public:${i}`, path: p }));

  const manifest: ManifestEntry[] = [];
  let bytes = 0;

  for (const g of groups) {
    const { bucket, prefix } = parsePath(g.path);
    const cleanPrefix = prefix ? (prefix.endsWith("/") ? prefix : prefix + "/") : "";
    console.log(`[导出] 组 ${g.name}: bucket=${bucket} prefix=${cleanPrefix || "(根)"}`);
    const [files] = await storage.bucket(bucket).getFiles({ prefix: cleanPrefix });
    for (const f of files) {
      const relPath = f.name.slice(cleanPrefix.length);
      if (!relPath || relPath.endsWith("/")) continue; // 目录占位
      if (relPath.startsWith("pending/")) {
        console.log(`  跳过隔离区文件: ${relPath}`);
        continue;
      }
      const [meta] = await f.getMetadata();
      const localPath = join(filesRoot, g.name.replace(":", "_"), relPath);
      mkdirSync(dirname(localPath), { recursive: true });
      await pipeline(f.createReadStream(), createWriteStream(localPath));
      manifest.push({
        group: g.name,
        relPath,
        contentType: (meta.contentType as string) || undefined,
        customMetadata: (meta.metadata as Record<string, string>) || undefined,
      });
      bytes += Number(meta.size || 0);
      console.log(`  ✓ ${relPath} (${meta.size} bytes)`);
    }
  }

  writeFileSync(join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n共导出 ${manifest.length} 个文件, 约 ${(bytes / 1024 / 1024).toFixed(1)} MB`);

  execSync(`tar czf attachments-export.tar.gz -C ${JSON.stringify(outRoot)} .`, { stdio: "inherit" });
  console.log("已打包: ./attachments-export.tar.gz — 在文件树中右键下载该文件");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
