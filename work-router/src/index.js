import { loadConfig } from "./config.js";
import { analyzeOpportunity } from "./analyzer.js";
import { fetchPublicProjects } from "./kwork.js";
import { fetchPublicMarketplaces } from "./public-marketplaces.js";
import { fetchGitHubBounties } from "./github-source.js";
import { createStore, takeLlmQuota } from "./store.js";
import { getUpdates, isAllowed, sendMessage } from "./telegram.js";
import { startWebServer } from "./web.js";
import { isWithinActiveHours } from "./schedule.js";
import { AcquisitionModel } from "./domain/opportunity.js";
import { calculateAcquisitionEconomics } from "./bounties/economics.js";
import { evaluateRewardTrust } from "./bounties/reward-trust/index.js";
import { evaluateBountyFeasibility, qualifiesForSmallBountyFastLane } from "./bounties/feasibility.js";
import { ensureSourceRegistry, calculateSourceQuality } from "./source-registry.js";
import { fetchTelegramSource } from "./telegram-public.js";
import { runDiscoveryCycle } from "./pipeline.js";
import { processOutbox, createOutbox } from "./outbox.js";

const config = loadConfig();
const store = createStore();
const log = (level, event, fields = {}) => console[level](JSON.stringify({ time: new Date().toISOString(), level, event, ...fields }));

function enrichOpportunity(item) {
  const acquisitionModel = item.acquisitionModel || (item.source === "telegram-manual" ? AcquisitionModel.INBOUND : item.source?.includes("github") ? AcquisitionModel.BOUNTY : AcquisitionModel.PAID);
  const opportunity = { ...item, acquisitionModel };
  if (acquisitionModel !== AcquisitionModel.BOUNTY) return opportunity;
  const rewardTrust = evaluateRewardTrust(opportunity.bounty || {});
  const feasibility = evaluateBountyFeasibility({ ...opportunity, rewardTrust });
  const economics = calculateAcquisitionEconomics({ expectedRevenue: rewardTrust.effectiveRewardForScoring, paymentProbability: rewardTrust.paymentProbability, winProbability: rewardTrust.winProbability, completionProbability: feasibility.overallFeasibilityScore / 100, llmCost: 0.05 });
  return { ...opportunity, rewardTrust, feasibility, economics, fastLane: qualifiesForSmallBountyFastLane({ ...opportunity, rewardTrust }, feasibility) };
}

async function deepAnalyze(item) {
  if (!takeLlmQuota(store, config.llm.dailyLimit)) { const error = new Error("Daily LLM quota exhausted"); error.code = "LLM_QUOTA"; throw error; }
  return analyzeOpportunity(config.llm, item);
}

function discoverySources() {
  const registry = ensureSourceRegistry(store);
  const sources = [
    { name: "kwork-public", fetch: async () => (await fetchPublicProjects(config.source)).map(enrichOpportunity) },
    { name: "freelance-ru/fl-ru", fetch: async () => (await fetchPublicMarketplaces(config.source)).map(enrichOpportunity) },
    { name: "github-bounties", fetch: async () => (await fetchGitHubBounties(config.github.token)).map(enrichOpportunity) },
  ];
  for (const source of registry.filter((item) => item.enabled && item.ingestionMode !== "manual")) sources.push({ name: source.id, registry: source, fetch: async () => (await fetchTelegramSource(source)).map(enrichOpportunity) });
  return sources;
}

async function processManualTelegram() {
  let updates;
  try { updates = await getUpdates(config.telegram, store.state.telegramOffset); }
  catch (error) { log("warn", "telegram_updates_failed", { error: error.message }); return; }
  const messages = [];
  for (const update of updates) {
    store.state.telegramOffset = update.update_id + 1;
    const message = update.message;
    if (!message?.text || !isAllowed(config.telegram, message)) continue;
    if (message.text === "/start") { createOutbox(store).enqueue({ opportunityId: `start:${update.update_id}`, kind: "system", chatId: String(message.chat.id), text: "CashClaw готов. Мониторинг источников работает; прогресс доступен в Mini App." }); continue; }
    messages.push({ source: "telegram-manual", title: message.text.slice(0, 120), description: message.text, publishedAt: new Date((message.date || Date.now() / 1000) * 1000).toISOString() });
  }
  if (messages.length) await runDiscoveryCycle({ store, sources: [{ name: "telegram-manual", fetch: async () => messages }], analyze: deepAnalyze, maxCheap: config.source.maxCheapPerCycle, maxDeep: config.source.maxDeepPerCycle, chatId: [...config.telegram.allowedChats][0], thresholds: config.notifications });
  store.save();
}

let running = false;
async function cycle() {
  if (running) { log("warn", "cycle_skipped", { reason: "already_running" }); return null; }
  if (!isWithinActiveHours(config.schedule)) { log("info", "cycle_paused", { schedule: config.schedule }); return null; }
  running = true;
  try {
    await processManualTelegram();
    const summary = await runDiscoveryCycle({ store, sources: discoverySources(), analyze: deepAnalyze, maxCheap: config.source.maxCheapPerCycle, maxDeep: config.source.maxDeepPerCycle, chatId: [...config.telegram.allowedChats][0], thresholds: config.notifications });
    for (const source of store.state.sources) source.qualityScore = calculateSourceQuality(source);
    try { const sentBefore = store.state.outbox.filter((item) => item.status === "sent").length; await processOutbox(store, (chatId, text) => sendMessage(config.telegram, chatId, text), { maxAttempts: config.notifications.outboxMaxAttempts }); summary.notificationsSent += store.state.outbox.filter((item) => item.status === "sent").length - sentBefore; summary.notificationsQueued = store.state.outbox.filter((item) => ["pending", "retry", "sending"].includes(item.status)).length; summary.deliveryErrors = store.state.outbox.filter((item) => item.status === "dead").length; }
    catch (error) { summary.deliveryErrors += 1; log("warn", "outbox_cycle_failed", { error: error.message }); }
    store.save(); log("info", "discovery_cycle_completed", { cycleId: summary.id, scanned: summary.scanned, newOpportunities: summary.newOpportunities, deepAnalyzed: summary.deepAnalyzed, sourceErrors: summary.sourceErrors.length }); return summary;
  } finally { running = false; }
}

async function testSource(username) { const source = ensureSourceRegistry(store).find((item) => item.username === username); if (!source) throw new Error("Source not found"); try { const items = await fetchTelegramSource(source); source.health = "healthy"; source.lastSuccess = new Date().toISOString(); source.lastError = null; source.lastChecked = source.lastSuccess; source.messagesFound += items.length; store.save(); return { count: items.length, health: source.health }; } catch (error) { source.health = error.code === "PUBLIC_UNAVAILABLE" ? "manual" : "degraded"; source.lastChecked = new Date().toISOString(); source.lastError = error.message; store.save(); throw error; } }

if (!process.argv.includes("--once")) startWebServer(config, store, { runCycle: cycle, testSource });
await cycle();
if (!process.argv.includes("--once")) { setInterval(() => cycle().catch((error) => log("error", "cycle_unhandled", { error: error.message })), config.pollMinutes * 60_000); log("info", "cashclaw_started", { pollMinutes: config.pollMinutes }); }
