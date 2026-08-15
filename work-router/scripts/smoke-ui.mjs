import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "../src/config.js";

const configRoot = process.env.CASHCLAW_CONFIG_ROOT || process.cwd();
const env = parseEnv(fs.readFileSync(path.join(configRoot, ".env"), "utf8"));
const userId = (env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").find(Boolean);
if (!userId || !env.TELEGRAM_BOT_TOKEN || !env.PLAYWRIGHT_CORE_PATH || !env.PLAYWRIGHT_EXECUTABLE_PATH) throw new Error("UI smoke prerequisites are missing");
const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "ui-smoke", user: JSON.stringify({ id: Number(userId) }) });
const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
const secret = crypto.createHmac("sha256", "WebAppData").update(env.TELEGRAM_BOT_TOKEN).digest();
params.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
const { chromium } = await import(pathToFileURL(env.PLAYWRIGHT_CORE_PATH));
const browser = await chromium.launch({ headless: true, executablePath: env.PLAYWRIGHT_EXECUTABLE_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on("console", (message) => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  await page.route("https://telegram.org/js/telegram-web-app.js", (route) => route.fulfill({ contentType: "text/javascript", body: `window.Telegram={WebApp:{initData:${JSON.stringify(params.toString())},ready(){},expand(){}}};` }));
  await page.goto("http://127.0.0.1:3777", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Источники" }).click();
  await page.waitForSelector(".source");
  const sourceCount = await page.locator(".source").count();
  await page.screenshot({ path: path.join(process.env.LOCALAPPDATA, "CashClaw", "mini-app-smoke.png"), fullPage: true });
  if (errors.length) throw new Error(`Browser console errors: ${errors.join(" | ")}`);
  if (sourceCount < 11) throw new Error(`Expected at least 11 sources, found ${sourceCount}`);
  console.log(JSON.stringify({ page: "ok", sources: sourceCount, consoleErrors: 0 }));
} finally { await browser.close(); }
