import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseBudget } from "../src/budget.js";
import { classifyOpportunity } from "../src/classifier.js";
import { deduplicateOpportunities } from "../src/dedupe.js";
import { allocateDeepSlots } from "../src/scheduler.js";
import { createStore } from "../src/store.js";
import { createOutbox, processOutbox } from "../src/outbox.js";
import { notificationBand, createNotifications } from "../src/notifications.js";
import { defaultTelegramSources, normalizeTelegramUsername } from "../src/source-registry.js";
import { parseTelegramChannelHtml, fetchTelegramSource } from "../src/telegram-public.js";
import { runDiscoveryCycle } from "../src/pipeline.js";
import { generateSourceReport } from "../src/report.js";

test("budget parser handles ranges, multipliers, currencies, and negotiable values", () => {
  assert.deepEqual(parseBudget("Бюджет $500-$1000"), { min: 500, max: 1000, currency: "USD", confidence: "high", raw: "$500-$1000" });
  assert.equal(parseBudget("от 50 тысяч рублей").min, 50000);
  assert.equal(parseBudget("50-100к").max, 100000);
  assert.equal(parseBudget("1000 USDT").currency, "USDT");
  assert.equal(parseBudget("по договорённости").confidence, "low");
  assert.equal(parseBudget("без бюджета"), null);
});

test("classifier prioritizes projects and rejects self promotion and unsafe work", () => {
  const project = classifyOpportunity({ description: "Нужно разработать Telegram Mini App на React, бюджет 50к, писать @client" }, new Date("2026-08-14T12:00:00Z"));
  assert.equal(project.classification, "ONE_OFF_PROJECT");
  assert.equal(project.budget.min, 50000);
  assert.equal(project.contactUsername, "client");
  assert.ok(project.skillMatch >= 80);
  assert.equal(classifyOpportunity({ description: "Ищу работу, вот моё резюме" }).classification, "SELF_PROMOTION");
  assert.equal(classifyOpportunity({ description: "Нужен captcha bypass и credential stealing" }).rejected, true);
  assert.equal(classifyOpportunity({ description: "Ищем co-founder, только доля" }).classification, "COFOUNDER");
});

test("deduplication merges reposts and retains every source link", () => {
  const items = deduplicateOpportunities([
    { source: "telegram:a", description: "Нужен React разработчик для Mini App бюджет 50к @client", url: "https://t.me/a/1", publishedAt: "2026-08-14T10:00:00Z", budget: { min: 50000 } },
    { source: "telegram:b", description: "Нужен React разработчик для Mini App. Бюджет 50к, контакт @client", url: "https://t.me/b/2", publishedAt: "2026-08-14T10:20:00Z", budget: { min: 50000 } },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].foundInSources, 2);
  assert.equal(items[0].sourceLinks.length, 2);
});

test("scheduler gives active sources a slot before filling by score", () => {
  const candidates = [
    { id: "a1", source: "a", preliminaryScore: 100 }, { id: "a2", source: "a", preliminaryScore: 99 },
    { id: "b1", source: "b", preliminaryScore: 70 }, { id: "c1", source: "c", preliminaryScore: 60 },
  ];
  const selected = allocateDeepSlots(candidates, 3);
  assert.deepEqual(new Set(selected.map((x) => x.source)), new Set(["a", "b", "c"]));
  assert.equal(allocateDeepSlots(candidates, 2).length, 2);
});

test("store migrates legacy state and outbox survives restart idempotently", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-state-"));
  fs.writeFileSync(path.join(root, "state.json"), JSON.stringify({ jobs: [{ id: "old" }], seen: ["x"] }));
  const store = createStore(root, { direct: true });
  assert.equal(store.state.version >= 2, true);
  assert.equal(store.state.jobs[0].id, "old");
  const outbox = createOutbox(store);
  const first = outbox.enqueue({ opportunityId: "o1", kind: "good", chatId: "1", text: "hello" });
  const second = outbox.enqueue({ opportunityId: "o1", kind: "good", chatId: "1", text: "hello" });
  assert.equal(first.id, second.id);
  store.save();
  const restarted = createStore(root, { direct: true });
  assert.equal(restarted.state.outbox.length, 1);
});

test("outbox retries transient failures then marks sent without duplicates", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-outbox-"));
  const store = createStore(root, { direct: true });
  const outbox = createOutbox(store);
  outbox.enqueue({ opportunityId: "o1", kind: "hot", chatId: "1", text: "x" });
  let calls = 0;
  await processOutbox(store, async () => { calls += 1; if (calls === 1) throw Object.assign(new Error("429"), { retryAfter: 0 }); }, { now: () => new Date("2026-08-14T10:00:00Z"), baseDelayMs: 0, jitter: () => 0 });
  await processOutbox(store, async () => { calls += 1; }, { now: () => new Date("2026-08-14T10:00:01Z"), baseDelayMs: 0, jitter: () => 0 });
  assert.equal(store.state.outbox[0].status, "sent");
  await processOutbox(store, async () => { calls += 1; });
  assert.equal(calls, 2);
});

test("notification bands include digest, fast alert, and bounty manual review", () => {
  assert.equal(notificationBand(70), "HOT");
  assert.equal(notificationBand(55), "GOOD");
  assert.equal(notificationBand(45), "MAYBE");
  assert.equal(notificationBand(44), "SILENT");
  const notices = createNotifications([
    { id: "h", title: "Hot", score: 80, preliminaryScore: 80, skillMatch: 90, ageMinutes: 20, proposalCost: 0 },
    { id: "m1", title: "Maybe 1", score: 50 }, { id: "m2", title: "Maybe 2", score: 49 },
    { id: "b", title: "Bounty", score: 80, acquisitionModel: "bounty", rewardTrust: { manualReview: true, advertisedReward: 100 } },
  ], "1");
  assert.equal(notices.filter((x) => x.kind === "maybe_digest").length, 1);
  assert.equal(notices.some((x) => x.kind === "fast"), true);
  assert.equal(notices.some((x) => x.kind === "bounty_review"), true);
});

test("notifications do not promote unreviewed full-time or unknown items", () => {
  const notices = createNotifications([
    { id: "full", title: "Full time", classification: "FULL_TIME_JOB", preliminaryScore: 90, skillMatch: 95, ageMinutes: 10, proposalCost: 0 },
    { id: "unknown", title: "Unknown", classification: "UNKNOWN", preliminaryScore: 80 },
  ], "1");
  assert.deepEqual(notices, []);
});

test("registry contains requested channels and validates usernames", () => {
  assert.equal(defaultTelegramSources().length, 11);
  assert.equal(defaultTelegramSources()[0].username, "job_for_bots");
  assert.equal(normalizeTelegramUsername("@FreeVacanciesIT"), "freevacanciesit");
  assert.throws(() => normalizeTelegramUsername("https://evil.invalid/x"));
});

test("public Telegram parser extracts id, timestamp, text, links, and source URL", () => {
  const html = `<div class="tgme_widget_message" data-post="sample/42"><a class="tgme_widget_message_date" href="https://t.me/sample/42"><time datetime="2026-08-14T10:00:00+00:00"></time></a><div class="tgme_widget_message_text">Нужен <b>React</b> разработчик <a href="https://example.com/job">детали</a></div></div>`;
  const items = parseTelegramChannelHtml(html, "sample");
  assert.equal(items[0].messageId, "42");
  assert.equal(items[0].publishedAt, "2026-08-14T10:00:00+00:00");
  assert.equal(items[0].links[0], "https://example.com/job");
  assert.equal(items[0].sourceMessageUrl, "https://t.me/sample/42");
});

test("public Telegram source becomes degraded on 429 without bypass", async () => {
  await assert.rejects(() => fetchTelegramSource({ username: "sample" }, async () => new Response("slow", { status: 429, headers: { "retry-after": "1" } })), (error) => error.code === "RATE_LIMITED" && error.degraded === true);
});

test("discovery cycle isolates source and analyzer failures", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cashclaw-cycle-"));
  const store = createStore(root, { direct: true });
  const summary = await runDiscoveryCycle({
    store,
    sources: [
      { name: "bad", fetch: async () => { throw new Error("offline"); } },
      { name: "good", fetch: async () => [{ source: "good", title: "Нужно сделать React API проект", description: "Нужно сделать React API проект, бюджет $500" }] },
    ],
    analyze: async () => { throw new Error("LLM down"); },
    maxDeep: 12,
    chatId: "1",
  });
  assert.equal(summary.sourceErrors.length, 1);
  assert.equal(summary.scanned.good, 1);
  assert.equal(summary.llmErrors, 1);
  assert.equal(summary.completed, true);
});

test("24h report ranks sources without mutating priorities", () => {
  const state = { sources: [{ username: "good", priority: "high", qualityScore: 80, stats: { messagesSeen: 100, opportunitiesDetected: 20, relevantOpportunities: 10, spam: 5, projectsWithBudget: 8, duplicates: 3 } }], cycles: [{ startedAt: "2026-08-14T10:00:00Z", newOpportunities: 5, deepAnalyzed: 2, HOT: 1 }] };
  const report = generateSourceReport(state, new Date("2026-08-14T12:00:00Z"));
  assert.match(report, /@good/);
  assert.match(report, /Deep analyzed: 2/);
  assert.equal(state.sources[0].priority, "high");
});
