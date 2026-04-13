import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { mdToPdf } from "md-to-pdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveManualPath(): string {
  const candidates = [
    path.resolve(__dirname, "../../../OPC操作手册.md"),
    path.resolve(process.cwd(), "OPC操作手册.md"),
    path.resolve(process.cwd(), "../../OPC操作手册.md"),
    path.resolve(process.cwd(), "../../../OPC操作手册.md"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot locate OPC操作手册.md. Searched: ${candidates.join(", ")}`);
}

function resolveOutputPath(): string {
  return path.resolve(__dirname, "OPC操作手册.pdf");
}

function resolveChromiumPath(): string | undefined {
  const envPath = process.env["CHROMIUM_PATH"];
  if (envPath && fs.existsSync(envPath)) return envPath;

  try {
    const resolved = execSync(
      "which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome-stable 2>/dev/null || true",
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    if (resolved && fs.existsSync(resolved)) return resolved;
  } catch {
  }

  return undefined;
}

function buildCss(fontPath: string): string {
  return `
  @font-face {
    font-family: 'NotoSansSC';
    src: url('file://${fontPath}') format('opentype');
    font-weight: normal;
    font-style: normal;
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'NotoSansSC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: #1f2937;
    margin: 0;
    padding: 0 8px;
  }

  h1 {
    font-size: 22px;
    color: #1e3a8a;
    border-bottom: 3px solid #2563eb;
    padding-bottom: 8px;
    margin-top: 24px;
    margin-bottom: 16px;
    page-break-after: avoid;
  }

  h2 {
    font-size: 16px;
    color: #1d4ed8;
    border-bottom: 1px solid #bfdbfe;
    padding-bottom: 4px;
    margin-top: 20px;
    margin-bottom: 12px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 14px;
    color: #1e40af;
    margin-top: 16px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  h4, h5, h6 {
    font-size: 13px;
    color: #374151;
    margin-top: 12px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }

  p {
    margin: 8px 0;
    orphans: 3;
    widows: 3;
  }

  a {
    color: #2563eb;
    text-decoration: none;
  }

  strong {
    font-weight: 700;
    color: #111827;
  }

  em {
    font-style: italic;
  }

  code {
    background: #f3f4f6;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
    font-family: 'Courier New', Courier, monospace;
    color: #92400e;
  }

  pre {
    background: #f3f4f6;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    margin: 8px 0;
  }

  pre code {
    background: none;
    padding: 0;
    color: #1f2937;
    font-size: 11px;
  }

  blockquote {
    margin: 12px 0;
    padding: 8px 12px;
    border-left: 4px solid #93c5fd;
    background: #eff6ff;
    color: #4b5563;
    border-radius: 0 4px 4px 0;
  }

  blockquote p {
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
    page-break-inside: avoid;
  }

  th {
    background: #2563eb;
    color: #ffffff;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
  }

  td {
    padding: 5px 10px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }

  tr:nth-child(even) td {
    background: #f9fafb;
  }

  ul, ol {
    margin: 8px 0;
    padding-left: 20px;
  }

  li {
    margin: 3px 0;
    line-height: 1.6;
  }

  hr {
    border: none;
    border-top: 1px solid #d1d5db;
    margin: 16px 0;
  }

  img {
    display: none;
  }

  @page {
    size: A4;
    margin: 20mm 18mm 20mm 18mm;

    @bottom-center {
      content: counter(page) " / " counter(pages);
      font-size: 10px;
      color: #9ca3af;
      font-family: 'NotoSansSC', sans-serif;
    }
  }
`;
}

export async function generateManualPdf(): Promise<string> {
  const mdPath = resolveManualPath();
  const outputPath = resolveOutputPath();
  const chromiumPath = resolveChromiumPath();

  const localFontPath = path.resolve(path.dirname(outputPath), "assets/fonts/NotoSansSC.otf");
  const css = buildCss(localFontPath);

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const pdf = await mdToPdf(
    { path: mdPath },
    {
      dest: outputPath,
      launch_options: {
        executablePath: chromiumPath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--run-all-compositor-stages-before-draw",
        ],
      },
      css,
      pdf_options: {
        format: "A4",
        margin: { top: "20mm", right: "18mm", bottom: "20mm", left: "18mm" },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="font-size:9px;color:#9ca3af;width:100%;text-align:center;font-family:sans-serif;">接单吧 OPC 操作手册</div>`,
        footerTemplate: `<div style="font-size:9px;color:#9ca3af;width:100%;text-align:center;font-family:sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
      },
      md_file_encoding: "utf-8",
      highlighted_code_blocks: false,
    },
  );

  if (!pdf || !pdf.filename) {
    throw new Error("md-to-pdf returned no output");
  }

  const stat = fs.statSync(outputPath);
  if (stat.size < 10000) {
    throw new Error(`Generated PDF is suspiciously small (${stat.size} bytes), generation may have failed`);
  }

  return outputPath;
}

export function getPdfOutputPath(): string {
  return resolveOutputPath();
}
