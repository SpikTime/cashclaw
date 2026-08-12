import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL("C:/Users/Brux/AppData/Local/CashClawRuntime/node_modules/playwright-core/index.mjs"));
const browser = await chromium.launch({ headless: true, executablePath: "C:/Users/Brux/AppData/Local/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-win64/chrome-headless-shell.exe" });
const sources = [
  ["freelance-ru", "https://freelance.ru/task"],
  ["fl-ru", "https://www.fl.ru/projects/"],
  ["habr", "https://freelance.habr.com/tasks"],
];
try {
  for (const [name, url] of sources) {
    const page = await browser.newPage({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(5_000);
      const links = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((a) => ({ href: a.href, text: a.textContent?.replace(/\s+/g, " ").trim() })).filter((x) => x.text && x.text.length > 8).slice(0, 80));
      console.log(JSON.stringify({ name, status: response?.status(), title: await page.title(), links }, null, 2));
    } catch (error) { console.log(JSON.stringify({ name, error: error.message })); }
    finally { await page.close(); }
  }
} finally { await browser.close(); }
