import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyOpportunity } from "../src/classifier.js";
import { scoreOpportunity, Eligibility, distributionStats } from "../src/scoring.js";
import { createNotifications, notificationBand } from "../src/notifications.js";
import { createStore } from "../src/store.js";
import { runDiscoveryCycle } from "../src/pipeline.js";
import { rankingFixture } from "./fixtures/ranking.js";

const now = new Date("2026-08-15T10:00:00Z");
const scored = () => rankingFixture.map((fixture) => scoreOpportunity(classifyOpportunity({ id: fixture.id, source: "benchmark", title: fixture.text, description: fixture.text, publishedAt: "2026-08-15T09:30:00Z" }, now)));

test("eligibility suppresses full-time, senior/lead, mismatched domains, and spam", () => {
  const byId = Object.fromEntries(scored().map((item) => [item.id, item]));
  for (const id of ["python-fulltime", "senior-frontend", "tech-lead", "php-go", "one-c", "csharp", "java", "native-mobile", "roblox-3d", "articles", "seo", "graphic", "spam"]) assert.equal(byId[id].eligibility, Eligibility.SUPPRESSED, id);
  assert.equal(byId["market-parser"].eligibility, Eligibility.ELIGIBLE);
  assert.equal(byId["part-time"].eligibility, Eligibility.LOW_PRIORITY);
  assert.equal(byId["unknown"].eligibility, Eligibility.LOW_PRIORITY);
  assert.ok(byId["tech-lead"].suppressedReason);
});

test("benchmark ranks freelance projects above employment and unrelated work", () => {
  const byId = Object.fromEntries(scored().map((item) => [item.id, item]));
  assert.ok(byId["crm-bot"].score > byId["python-fulltime"].score);
  assert.ok(byId["market-parser"].score > byId["senior-frontend"].score);
  assert.ok(byId["react-fix"].score > byId["tech-lead"].score);
  assert.ok(byId["mini-app"].score > byId["roblox-3d"].score);
  assert.ok(byId["sales-dashboard"].score > byId["articles"].score);
  assert.ok(byId["tech-lead"].score < 30);
});

test("score has an explainable breakdown and meaningful distribution", () => {
  const results = scored();
  const stats = distributionStats(results.map((item) => item.score));
  assert.ok(stats.max >= 76, JSON.stringify(stats));
  assert.ok(stats.min < 35, JSON.stringify(stats));
  assert.ok(results.some((item) => item.score >= 50 && item.score <= 70));
  assert.ok(stats.standardDeviation >= 15, JSON.stringify(stats));
  assert.ok(stats.p75 - stats.p25 >= 20, JSON.stringify(stats));
  const strong = results.find((item) => item.id === "crm-bot");
  assert.deepEqual(Object.keys(strong.scoreBreakdown), ["projectType", "skillFit", "monetary", "vibeCoding", "winProbability", "freshness", "clarity", "penalties"]);
  assert.ok(strong.scoreReasons.length >= 3);
});

test("suppressed opportunities never notify and new thresholds are calibrated", () => {
  const byId = Object.fromEntries(scored().map((item) => [item.id, item]));
  assert.equal(notificationBand(80), "HOT");
  assert.equal(notificationBand(67), "GOOD");
  assert.equal(notificationBand(52), "MAYBE");
  assert.equal(notificationBand(51), "SILENT");
  assert.deepEqual(createNotifications([{ ...byId["tech-lead"], score: 99 }], "1"), []);
});

test("deep analysis enriches text but cannot replace deterministic score", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-score-"));
  const store = createStore(root, { direct: true });
  await runDiscoveryCycle({ store, sources: [{ name: "fixture", fetch: async () => [{ source: "fixture", title: rankingFixture[0].text, description: rankingFixture[0].text, publishedAt: "2026-08-15T09:30:00Z" }] }], analyze: async () => ({ score: 50, summary: "LLM summary" }), maxDeep: 1, chatId: "1" });
  const item = store.state.opportunities[0];
  assert.notEqual(item.score, 50);
  assert.equal(item.llmScore, 50);
  assert.equal(item.summary, "LLM summary");
});

test("state migration preserves the old score for audit and recalculates ranking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-score-migrate-"));
  fs.writeFileSync(path.join(root, "state.json"), JSON.stringify({ version: 2, opportunities: [{ id: "old", title: "Senior Frontend Developer full-time", description: "Senior React developer, full-time salary per month", classification: "FULL_TIME_JOB", score: 50, preliminaryScore: 60 }] }));
  const store = createStore(root, { direct: true });
  const item = store.state.opportunities[0];
  assert.equal(store.state.version, 3);
  assert.equal(item.legacyScore, 50);
  assert.equal(item.scoringVersion, 2);
  assert.equal(item.eligibility, Eligibility.SUPPRESSED);
  assert.ok(item.score < 30);
});

test("pipeline persists visible opportunities in deterministic rank order", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-score-order-"));
  const store = createStore(root, { direct: true });
  await runDiscoveryCycle({ store, sources: [{ name: "fixture", fetch: async () => rankingFixture.slice(0, 5).map((fixture) => ({ source: "fixture", title: fixture.text, description: fixture.text, publishedAt: "2026-08-15T09:30:00Z" })) }], analyze: async () => ({}), maxDeep: 0, chatId: "1" });
  const visible = store.state.opportunities.filter((item) => item.eligibility !== Eligibility.SUPPRESSED);
  assert.deepEqual(visible.map((item) => item.score), [...visible.map((item) => item.score)].sort((a, b) => b - a));
});
