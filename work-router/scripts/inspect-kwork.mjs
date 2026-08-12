import { pathToFileURL } from "node:url";

const runtime = "C:/Users/Brux/AppData/Local/CashClawRuntime/node_modules/playwright-core/index.mjs";
const { chromium } = await import(pathToFileURL(runtime));
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Users/Brux/AppData/Local/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-win64/chrome-headless-shell.exe",
});
try {
  const page = await browser.newPage({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
  await page.goto("https://kwork.ru/projects", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(8_000);
  const data = await page.locator('a[href^="/projects/"]').evaluateAll((links) => links.slice(0, 5).map((a) => {
    let node = a;
    const parents = [];
    for (let i = 0; i < 5 && node; i++, node = node.parentElement) parents.push({ tag: node.tagName, className: node.className, text: node.innerText?.replace(/\s+/g, " ").trim().slice(0, 700) });
    return { href: a.href, parents };
  }));
  console.log(JSON.stringify(data, null, 2));
} finally {
  await browser.close();
}
