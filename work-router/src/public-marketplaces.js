import { pathToFileURL } from "node:url";

const SOURCES = [
  {
    id: "freelance-ru-public",
    url: "https://freelance.ru/task",
    selector: 'a[href*="/task/view/"]',
    path: /^\/task\/view\/\d+$/,
  },
  {
    id: "fl-ru-public",
    url: "https://www.fl.ru/projects/",
    selector: 'a[href*="/projects/"][href$=".html"]',
    path: /^\/projects\/\d+\/.+\.html$/,
  },
];

function unique(items) {
  return [...new Map(items.map((item) => [item.url, item])).values()];
}

export async function fetchPublicMarketplaces(config) {
  const { chromium } = await import(pathToFileURL(config.playwrightCorePath));
  const browser = await chromium.launch({ headless: true, executablePath: config.playwrightExecutablePath });
  const results = [];
  try {
    for (const source of SOURCES) {
      const page = await browser.newPage({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
      try {
        const response = await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        if (!response || [403, 429].includes(response.status())) continue;
        await page.locator(source.selector).first().waitFor({ state: "visible", timeout: 15_000 });
        const items = await page.locator(source.selector).evaluateAll((links, sourceId) => links.map((link) => {
          const title = link.textContent?.replace(/\s+/g, " ").trim();
          if (!title || /^(откликнуться|ответов|подробнее)$/i.test(title)) return null;
          let node = link.parentElement;
          let description = title;
          for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) {
            const text = node.innerText?.replace(/\s+/g, " ").trim() || "";
            if (text.length > description.length && text.length < 1800) description = text;
          }
          return { source: sourceId, title, description, url: link.href };
        }).filter(Boolean), source.id);
        results.push(...unique(items).filter((item) => source.path.test(new URL(item.url).pathname)));
      } catch (error) { console.warn(`${source.id}: ${error.message}`); }
      finally { await page.close(); }
    }
  } finally { await browser.close(); }
  return results;
}
