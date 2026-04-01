import { chromium } from "playwright-core";
import fs from "fs";

const BASE = "https://www.opcorder.com";
const OUT  = "screenshots_prod";
fs.mkdirSync(OUT, { recursive: true });

const BROWSER_PATH =
  "/home/runner/pw-browsers/chromium_headless_shell-1217/chrome-headless-shell-linux64/chrome-headless-shell";

const ACCOUNTS = {
  opc: {
    email: "zhaoyuanzhang@aieducenter.com",
    password: "opc123",
    pages: [
      { file: "03_OPC首页",      path: "/" },
      { file: "04_接单大厅",      path: "/order-hall" },
      { file: "05_我的订单",      path: "/orders" },
      { file: "06_我的资料",      path: "/profile" },
      { file: "07_我的作品集",    path: "/portfolios" },
      { file: "08_学习中心",      path: "/academy" },
      { file: "09_通知中心_OPC",  path: "/notifications" },
      { file: "10_收入明细",      path: "/income" },
      { file: "11_结算账户",      path: "/settlement-account" },
      { file: "12_社区广场_OPC",  path: "/community" },
    ],
  },
  publisher: {
    email: "support@aieducenter.com",
    password: "admin123",
    pages: [
      { file: "13_发单方首页",    path: "/publisher" },
      { file: "14_需求列表",      path: "/publisher/demands" },
      { file: "15_发布新需求",    path: "/publisher/demands/new" },
      { file: "16_订单管理",      path: "/publisher/orders" },
      { file: "17_OPC人才库",     path: "/publisher/opc-library" },
      { file: "18_财务管理",      path: "/publisher/finance" },
      { file: "19_通知_发单方",   path: "/publisher/notifications" },
      { file: "20_机构资料",      path: "/publisher/profile" },
      { file: "21_驾驶舱",        path: "/publisher/cockpit" },
      { file: "22_争议处理",      path: "/publisher/disputes" },
    ],
  },
  admin: {
    email: "admin@jiedanba.com",
    password: "admin123",
    pages: [
      { file: "23_平台管理后台",  path: "/admin" },
    ],
  },
};

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(page, email, password) {
  console.log(`  Logging in as ${email}...`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await wait(1500);

  // Fill email field
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.fill(email);

  // Fill password field
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill(password);

  // Click submit
  const btn = page.locator('button[type="submit"]').first();
  await btn.click();

  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await wait(2500);
  console.log(`  → now at: ${page.url()}`);
}

async function shot(page, file) {
  await wait(2000);
  await page.screenshot({
    path: `${OUT}/${file}.jpg`,
    type: "jpeg",
    quality: 90,
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
  });
  console.log(`    ✓ ${file}`);
}

async function run() {
  console.log("Launching Playwright Chromium headless shell...");
  const browser = await chromium.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  // ── Public pages (no login) ───────────────────────────────
  {
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();

    console.log("\n[Public] Login page");
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await shot(page, "01_登录页");

    console.log("[Public] Community (guest)");
    await page.goto(`${BASE}/community`, { waitUntil: "networkidle", timeout: 30000 });
    await shot(page, "02_社区广场_访客");

    await ctx.close();
  }

  // ── Authenticated accounts ────────────────────────────────
  for (const [role, cfg] of Object.entries(ACCOUNTS)) {
    console.log(`\n[${role}] Logging in...`);
    const ctx  = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();

    await login(page, cfg.email, cfg.password);

    for (const { file, path: pagePath } of cfg.pages) {
      console.log(`  → ${file}`);
      await page.goto(`${BASE}${pagePath}`, { waitUntil: "networkidle", timeout: 30000 });
      await shot(page, file);
    }

    await ctx.close();
  }

  await browser.close();
  console.log("\nAll screenshots saved to:", OUT);
}

run().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
