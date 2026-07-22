import { logger } from "./logger";

export interface FetchedSkill {
  name: string;
  description: string;
  skillMd: string;
  refFiles: Record<string, string>;
  version: string;
}

const ALLOWED_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "skillsovermcp.com",
]);

function assertAllowedHost(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`无效的 URL 格式：${rawUrl}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`仅允许 HTTPS 协议，收到：${parsed.protocol}`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error(
      `不允许访问的主机：${hostname}。仅支持 github.com、raw.githubusercontent.com、skillsovermcp.com`
    );
  }
}

/**
 * Convert any GitHub URL (repo root, blob, raw) to a raw content URL for a specific path.
 */
function toRawGithubUrl(repoBase: string, branch: string, filePath: string): string {
  const treeMatch = repoBase.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (!treeMatch) throw new Error(`Cannot parse GitHub repo URL: ${repoBase}`);
  const [, owner, repo] = treeMatch;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "JieDanBa-SkillFetcher/1.0", "Accept": "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = await res.json() as { default_branch?: string };
      return data.default_branch ?? "main";
    }
  } catch {
  }
  return "main";
}

/**
 * Parse a skill source URL into a raw SKILL.md URL and repo base.
 * Supports:
 *  - https://github.com/owner/repo  (repo root — resolves default branch via API)
 *  - https://github.com/owner/repo/tree/branch  (specific branch)
 *  - https://github.com/owner/repo/blob/main/SKILL.md  (file link)
 *  - https://raw.githubusercontent.com/owner/repo/main/SKILL.md  (raw link)
 *  - https://skillsovermcp.com/...  (skill page — extract GitHub source from page HTML)
 */
async function resolveSkillMdUrl(inputUrl: string): Promise<{ rawUrl: string; repoBase: string }> {
  const url = inputUrl.trim();
  assertAllowedHost(url);

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "raw.githubusercontent.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    const repo = parts[1];
    const repoBase = `https://github.com/${owner}/${repo}`;
    return { rawUrl: url, repoBase };
  }

  if (hostname === "github.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) throw new Error("GitHub URL 至少需要包含 owner/repo");
    const owner = parts[0];
    const repo = parts[1];
    const repoBase = `https://github.com/${owner}/${repo}`;

    if (parts[2] === "blob" && parts.length >= 4) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${parts.slice(3).join("/")}`;
      assertAllowedHost(rawUrl);
      return { rawUrl, repoBase };
    }

    if (parts[2] === "tree" && parts.length >= 4) {
      const branch = parts[3];
      const rawUrl = toRawGithubUrl(repoBase, branch, "SKILL.md");
      assertAllowedHost(rawUrl);
      return { rawUrl, repoBase };
    }

    const branch = await resolveDefaultBranch(owner, repo);
    const rawUrl = toRawGithubUrl(repoBase, branch, "SKILL.md");
    assertAllowedHost(rawUrl);
    return { rawUrl, repoBase };
  }

  if (hostname === "skillsovermcp.com") {
    const html = await fetchText(url);
    const ghMatch = html.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-][^"'\s]*/);
    if (!ghMatch) throw new Error("无法从 skillsovermcp.com 页面提取 GitHub 仓库链接");
    const extracted = ghMatch[0];
    assertAllowedHost(extracted);
    return resolveSkillMdUrl(extracted);
  }

  throw new Error(`不支持的 URL 格式：${url}。请提供 GitHub 仓库地址或文件直链。`);
}

async function fetchText(url: string): Promise<string> {
  assertAllowedHost(url);
  const res = await fetch(url, {
    headers: { "User-Agent": "JieDanBa-SkillFetcher/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} 获取 ${url} 失败`);
  }
  return res.text();
}

/**
 * Extract `references/` file paths mentioned in SKILL.md content.
 */
function extractReferencePaths(skillMd: string): string[] {
  const paths = new Set<string>();
  const regex = /(?:^|\s|[\[(])\.?\/?references\/([^\s\])"']+)/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(skillMd)) !== null) {
    paths.add(`references/${m[1]}`);
  }
  return Array.from(paths);
}

function extractSkillName(skillMd: string, repoBase: string): string {
  const h1 = skillMd.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();
  const repoMatch = repoBase.match(/\/([^/]+)$/);
  return repoMatch ? repoMatch[1] : "Unnamed Skill";
}

function extractSkillDescription(skillMd: string): string {
  const lines = skillMd.split("\n");
  let passedTitle = false;
  const paragraphLines: string[] = [];
  for (const line of lines) {
    if (!passedTitle && line.startsWith("#")) { passedTitle = true; continue; }
    if (!passedTitle) continue;
    if (line.trim() === "" && paragraphLines.length > 0) break;
    if (line.trim() !== "" && !line.startsWith("#")) paragraphLines.push(line.trim());
  }
  const para = paragraphLines.join(" ").trim();
  return para.length > 300 ? para.slice(0, 297) + "…" : (para || skillMd.slice(0, 200).trim());
}

export async function fetchSkillFromUrl(inputUrl: string): Promise<FetchedSkill> {
  const { rawUrl, repoBase } = await resolveSkillMdUrl(inputUrl);
  logger.info({ rawUrl }, "Fetching SKILL.md");
  const skillMd = await fetchText(rawUrl);

  const name = extractSkillName(skillMd, repoBase);
  const description = extractSkillDescription(skillMd);

  const skillMdDirUrl = rawUrl.replace(/\/[^/]+$/, "");

  const refPaths = extractReferencePaths(skillMd);
  const refFiles: Record<string, string> = {};
  await Promise.allSettled(
    refPaths.map(async (relPath) => {
      try {
        const refUrl = `${skillMdDirUrl}/${relPath}`.replace(/\/\.\//g, "/");
        assertAllowedHost(refUrl);
        const content = await fetchText(refUrl);
        refFiles[relPath] = content;
        logger.info({ relPath }, "Fetched reference file");
      } catch (err) {
        logger.warn({ err, relPath }, "Failed to fetch reference file — skipping");
      }
    })
  );

  const version = new Date().toISOString();

  return { name, description, skillMd, refFiles, version };
}
