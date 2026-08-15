const PROJECT_LINK = /href=["'](\/projects\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
import { pathToFileURL } from "node:url";
import { rankByAcquisition } from "./domain/opportunity.js";

function cleanHtml(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePublicProjects(html) {
  const projects = [];
  const seen = new Set();
  for (const match of html.matchAll(PROJECT_LINK)) {
    const url = new URL(match[1], "https://kwork.ru").href;
    const title = cleanHtml(match[2]);
    if (!title || seen.has(url)) continue;
    seen.add(url);
    projects.push({ source: "kwork-public", title, description: title, url });
  }
  return projects;
}

async function fetchStaticProjects() {
  const response = await fetch("https://kwork.ru/projects", {
    headers: { Accept: "text/html", "User-Agent": "CashClaw-Public-Monitor/0.1" },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (response.status === 403 || response.status === 429) {
    const error = new Error(`Kwork temporarily unavailable: ${response.status}`);
    error.retryAfter = Number(response.headers.get("retry-after") || 0);
    throw error;
  }
  if (!response.ok) throw new Error(`Kwork request failed: ${response.status}`);
  return parsePublicProjects(await response.text());
}

export async function fetchPublicProjects(browserConfig = {}) {
  if (!browserConfig.playwrightCorePath || !browserConfig.playwrightExecutablePath) return fetchStaticProjects();
  const { chromium } = await import(pathToFileURL(browserConfig.playwrightCorePath));
  const browser = await chromium.launch({ headless: true, executablePath: browserConfig.playwrightExecutablePath });
  try {
    const page = await browser.newPage({ locale: "ru-RU", viewport: { width: 1280, height: 900 } });
    const response = await page.goto("https://kwork.ru/projects", { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (!response) throw new Error("Kwork returned no response");
    if ([403, 429].includes(response.status())) throw new Error(`Kwork temporarily unavailable: ${response.status()}`);
    await page.locator(".want-card").first().waitFor({ state: "visible", timeout: 20_000 });
    return await page.locator(".want-card").evaluateAll((cards) => cards.map((card) => {
      const link = card.querySelector('h1 a[href^="/projects/"]');
      if (!link || !/^\/projects\/\d+$/.test(new URL(link.href).pathname)) return null;
      const title = link.textContent?.replace(/\s+/g, " ").trim();
      const description = card.innerText?.replace(/\s+/g, " ").trim();
      return title && description ? { source: "kwork-public-browser", title, description, url: link.href } : null;
    }).filter(Boolean));
  } finally { await browser.close(); }
}

export function prefilterProjects(projects, keywords, limit = 5, options = {}) {
  const excluded = options.excludeKeywords || [];
  const minMatches = options.minKeywordMatches || 1;
  const minBudget = options.minBudgetRub || 0;
  return projects.map((project) => {
    const text = `${project.title} ${project.description}`.toLowerCase();
    const matches = keywords.filter((keyword) => text.includes(keyword));
    const budget = Number((text.match(/(?:желаемый бюджет|бюджет):[^\d]{0,20}([\d\s]+)/i)?.[1] || "0").replace(/\s/g, ""));
    const rejected = excluded.some((keyword) => text.includes(keyword));
    const trust = Number(project.rewardTrust?.rewardTrustScore || 0);
    const anomalyPenalty = Number(project.rewardTrust?.anomaly?.penalty || 0);
    const expectedProfit = Math.min(100, Math.max(-100, Number(project.economics?.riskAdjustedNetProfit || 0)));
    return { project, rank: matches.length * 100 + Math.min(budget / 1000, 99) + rankByAcquisition(project) * 15 + trust / 4 + expectedProfit / 5 - anomalyPenalty, matches, budget, rejected };
  }).filter((item) => !item.rejected && item.matches.length >= minMatches && (!item.budget || item.budget >= minBudget)).sort((a, b) => b.rank - a.rank).slice(0, limit).map((item) => ({ ...item.project, prefilterMatches: item.matches }));
}
