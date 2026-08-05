/**
 * import-attachments.ts — 在【新项目】运行,把导出的附件包导入新的对象存储 bucket。
 *
 * 前置:
 *   1. 已在本项目创建 Object Storage bucket,并设置 PRIVATE_OBJECT_DIR / PUBLIC_OBJECT_SEARCH_PATHS
 *   2. 已把 attachments-export.tar.gz 上传到项目根目录
 *
 * 用法:
 *   mkdir -p /tmp/att && tar xzf attachments-export.tar.gz -C /tmp/att
 *   pnpm --filter @workspace/scripts exec tsx ./src/import-attachments.ts /tmp/att
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync, createReadStream } from "fs";
import { join } from "path";
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

interface ManifestEntry {
  group: string;
  relPath: string;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

function parsePath(p: string): { bucket: string; prefix: string } {
  const parts = p.replace(/^\/+/, "").split("/");
  return { bucket: parts[0]!, prefix: parts.slice(1).join("/") };
}

async function main() {
  const srcRoot = process.argv[2];
  if (!srcRoot) throw new Error("用法: tsx ./src/import-attachments.ts <解包目录>");

  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  const publicPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync(join(srcRoot, "manifest.json"), "utf8"),
  );

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

  let ok = 0;
  for (const e of manifest) {
    const base = targetFor(e.group);
    const { bucket, prefix } = parsePath(base);
    const objectName = (prefix ? prefix.replace(/\/+$/, "") + "/" : "") + e.relPath;
    const localPath = join(srcRoot, "files", e.group.replace(":", "_"), e.relPath);
    const file = storage.bucket(bucket).file(objectName);
    await pipeline(
      createReadStream(localPath),
      file.createWriteStream({
        contentType: e.contentType,
        resumable: false,
        metadata: { metadata: e.customMetadata }, // 保留 custom:aclPolicy 等自定义元数据
      }),
    );
    ok++;
    console.log(`✓ [${e.group}] ${e.relPath}`);
  }
  console.log(`\n导入完成: ${ok}/${manifest.length} 个文件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
