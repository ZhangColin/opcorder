/**
 * 接单吧 生产环境截图脚本
 * =====================================================
 * 使用方法（在您自己的电脑上运行）：
 *
 *   1. 确保已安装 Node.js 18+  (node -v)
 *   2. 安装依赖：
 *        npm install playwright
 *        npx playwright install chromium
 *   3. 运行脚本：
 *        node take-prod-screenshots-local.mjs
 *   4. 截图保存在当前目录的 screenshots_prod/ 文件夹中
 * =====================================================
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "https://www.opcorder.com";
const OUT  = "screenshots_prod";
fs.mkdirSync(OUT, { recursive: true });

/* ── 页面配置 ─────────────────────────────────────── */

const PUBLIC_PAGES = [
  { file: "01_登录页",        path: "/login" },
  { file: "02_社区广场_访客", path: "/community" },
];

const ACCOUNTS = {
  opc: {
    email:    "zhaoyuanzhang@aieducenter.com",
    password: "opc123",
    pages: [
      { file: "03_OPC首页",      path: "/" },
      { file: "04_接单大厅",     path: "/order-hall" },
      { file: "05_我的订单",     path: "/orders" },
      { file: "06_我的资料",     path: "/profile" },
      { file: "07_我的作品集",   path: "/portfolios" },
      { file: "08_学习中心",     path: "/academy" },
      { file: "09_通知中心_OPC", path: "/notifications" },
      { file: "10_收入明细",     path: "/income" },
      { file: "11_结算账户",     path: "/settlement-account" },
      { file: "12_社区广场_OPC", path: "/community" },
    ],
  },
  publisher: {
    email:    "support@aieducenter.com",
    password: "admin123",
    pages: [
      { file: "13_发单方首页",  path: "/publisher" },
      { file: "14_需求列表",    path: "/publisher/demands" },
      { file: "15_发布新需求",  path: "/publisher/demands/new" },
      { file: "16_订单管理",    path: "/publisher/orders" },
      { file: "17_OPC人才库",   path: "/publisher/opc-library" },
      { file: "18_财务管理",    path: "/publisher/finance" },
      { file: "19_通知_发单方", path: "/publisher/notifications" },
      { file: "20_机构资料",    path: "/publisher/profile" },
      { file: "21_驾驶舱",      path: "/publisher/cockpit" },
      { file: "22_争议处理",    path: "/publisher/disputes" },
    ],
  },
  admin: {
    email:    "admin@jiedanba.com",
    password: "admin123",
    pages: [
      { file: "23_平台管理后台", path: "/admin" },
    ],
  },
};

/* ── 工具函数 ─────────────────────────────────────── */

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, file) {
  // 等待页面稳定
  await page.waitForLoadState("networkidle").catch(() => {});
  await wait(1500);
  const outPath = path.join(OUT, `${file}.jpg`);
  await page.screenshot({
    path: outPath,
    type: "jpeg",
    quality: 92,
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  console.log(`  ✓  ${file}`);
}

async function login(page, email, password) {
  console.log(`  登录中：${email}`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await wait(800);

  // 邮箱
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  // 密码
  await page.locator('input[type="password"]').first().fill(password);
  // 提交
  await page.locator('button[type="submit"]').first().click();

  // 等待跳转完成
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await wait(2000);
  console.log(`  → 当前页面：${page.url()}`);
}

/* ── 主流程 ───────────────────────────────────────── */

async function run() {
  console.log("启动浏览器（1920×1080）...\n");
  const browser = await chromium.launch({
    headless: true,           // 改为 false 可以看到浏览器窗口（调试用）
    args: ["--no-sandbox"],
  });

  /* 公开页面 */
  console.log("=== 公开页面（无需登录）===");
  {
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    for (const { file, path: p } of PUBLIC_PAGES) {
      console.log(`  → ${file}`);
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 30000 });
      await shot(page, file);
    }
    await ctx.close();
  }

  /* 登录账号页面 */
  for (const [role, cfg] of Object.entries(ACCOUNTS)) {
    console.log(`\n=== ${role.toUpperCase()} 账号页面 ===`);
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();

    await login(page, cfg.email, cfg.password);

    for (const { file, path: p } of cfg.pages) {
      console.log(`  → ${file}`);
      await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 30000 });
      await shot(page, file);
    }

    await ctx.close();
  }

  await browser.close();
  console.log(`\n全部完成！截图已保存至 ${path.resolve(OUT)}/`);
}

run().catch(err => {
  console.error("\n脚本出错：", err.message);
  process.exit(1);
});
