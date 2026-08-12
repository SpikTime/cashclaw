import { createHash } from "node:crypto";
import { loadConfig } from "./config.js";
import { analyzeOpportunity } from "./analyzer.js";
import { fetchPublicProjects, prefilterProjects } from "./kwork.js";
import { fetchPublicMarketplaces } from "./public-marketplaces.js";
import { fetchGitHubBounties } from "./github-source.js";
import { createStore, takeLlmQuota } from "./store.js";
import { formatAnalysis, getUpdates, isAllowed, sendMessage } from "./telegram.js";
import { startWebServer } from "./web.js";
import { isWithinActiveHours } from "./schedule.js";
import { AcquisitionModel } from "./domain/opportunity.js";
import { calculateAcquisitionEconomics } from "./bounties/economics.js";
import { evaluateRewardTrust } from "./bounties/reward-trust/index.js";
import { evaluateBountyFeasibility, qualifiesForSmallBountyFastLane } from "./bounties/feasibility.js";

const config = loadConfig();
const store = createStore();
const hash = (value) => createHash("sha256").update(value).digest("hex");

function enrichOpportunity(item) {
  const acquisitionModel = item.acquisitionModel || (item.source === "telegram-manual" ? AcquisitionModel.INBOUND : item.source?.includes("github") ? AcquisitionModel.BOUNTY : AcquisitionModel.PAID);
  const opportunity = { ...item, acquisitionModel };
  if (acquisitionModel !== AcquisitionModel.BOUNTY) return opportunity;
  const rewardTrust = evaluateRewardTrust(opportunity.bounty || {});
  const feasibility = evaluateBountyFeasibility({ ...opportunity, rewardTrust });
  const economics = calculateAcquisitionEconomics({
    expectedRevenue: rewardTrust.effectiveRewardForScoring,
    paymentProbability: rewardTrust.paymentProbability,
    winProbability: rewardTrust.winProbability,
    completionProbability: feasibility.overallFeasibilityScore / 100,
    llmCost: 0.05,
  });
  return { ...opportunity, rewardTrust, feasibility, economics, fastLane: qualifiesForSmallBountyFastLane({ ...opportunity, rewardTrust }, feasibility) };
}

function bountyDecision(project) {
  if (project.acquisitionModel !== AcquisitionModel.BOUNTY) return "analyze";
  if (project.rewardTrust.manualReview) return "manual_review";
  if (project.rewardTrust.rewardTrustScore < config.acquisition.minimumRewardTrustScore) return "skip";
  if (project.feasibility.technicalRisk > config.acquisition.maximumTechnicalRisk) return "skip";
  if (100 - project.rewardTrust.paymentProbability * 100 > config.acquisition.maximumPaymentRisk) return "skip";
  if (project.economics.riskAdjustedNetProfit < config.acquisition.minimumExpectedNetProfit) return "skip";
  if (project.economics.riskAdjustedNetProfit / Math.max(1, project.feasibility.estimatedAgentTime) < config.acquisition.minimumExpectedProfitPerAgentHour) return "skip";
  return "analyze";
}

async function evaluate(item, chatId, notifyBelowThreshold = false, jobId = null) {
  const id = hash(`${item.source}:${item.url || item.description}`);
  if (store.has(id)) return;
  if (!takeLlmQuota(store, config.llm.dailyLimit)) {
    if (jobId) { store.updateJob(jobId, { status: "deferred" }); store.save(); }
    return;
  }
  try {
    if (jobId) { store.updateJob(jobId, { status: "analyzing" }); store.save(); }
    const analysis = await analyzeOpportunity(config.llm, item);
    store.mark(id);
    if (jobId) store.updateJob(jobId, { status: "ready", ...analysis });
    if (notifyBelowThreshold || analysis.score >= 60) await sendMessage(config.telegram, chatId, formatAnalysis(item, analysis));
  } catch (error) {
    if (jobId) store.updateJob(jobId, { status: "error", error: "Не удалось выполнить анализ. Повторите позже." });
    throw error;
  } finally { store.save(); }
}

async function processTelegram() {
  const updates = await getUpdates(config.telegram, store.state.telegramOffset);
  for (const update of updates) {
    store.state.telegramOffset = update.update_id + 1;
    const message = update.message;
    if (!message?.text || !isAllowed(config.telegram, message)) continue;
    if (message.text === "/start") {
      await sendMessage(config.telegram, message.chat.id, "CashClaw готов. Пришлите текст или ссылку на объявление для оценки.");
      continue;
    }
    const jobId = hash(`telegram:${update.update_id}:${message.text}`);
    store.addJob({ id: jobId, title: message.text.slice(0, 100), status: "queued", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    store.save();
    await sendMessage(config.telegram, message.chat.id, "Объявление принято. Claude начинает анализ — прогресс виден в Mini App.");
    await evaluate({ source: "telegram-manual", description: message.text }, message.chat.id, true, jobId);
  }
}

async function processSources() {
  const chatId = [...config.telegram.allowedChats][0];
  if (!chatId) return;
  const projects = [];
  const sources = [
    ["kwork-public", () => fetchPublicProjects(config.source)],
    ["freelance-ru/fl-ru", () => fetchPublicMarketplaces(config.source)],
    ["github-bounties", () => fetchGitHubBounties(config.github.token)],
  ];
  for (const [name, fetchSource] of sources) {
    try {
      const items = await fetchSource();
      projects.push(...items.map(enrichOpportunity));
      console.log(`${name}: found ${items.length}`);
    } catch (error) {
      console.warn(`${name}: ${error.message}`);
    }
  }
  const selected = prefilterProjects(projects, config.source.skillKeywords, config.source.maxLlmPerCycle, config.source);
  for (const project of selected) {
    const jobId = hash(`${project.source}:${project.url || project.description}`);
    if (store.has(jobId)) continue;
    const decision = bountyDecision(project);
    if (!store.getJob(jobId)) store.addJob({ id: jobId, title: project.title, source: project.source, url: project.url, acquisitionModel: project.acquisitionModel, bounty: project.bounty, rewardTrust: project.rewardTrust, feasibility: project.feasibility, economics: project.economics, fastLane: project.fastLane, moneyStatus: project.acquisitionModel === AcquisitionModel.BOUNTY ? "potential" : undefined, status: decision === "analyze" ? "queued" : decision, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    store.save();
    if (decision !== "analyze") continue;
    await evaluate(project, chatId, false, jobId);
  }
}

async function cycle() {
  if (!isWithinActiveHours(config.schedule)) {
    console.log(`Paused outside active hours ${config.schedule.start}-${config.schedule.end} ${config.schedule.timeZone}`);
    return;
  }
  await processTelegram();
  try { await processSources(); } catch (error) { console.warn(error.message); }
  store.save();
}

if (!process.argv.includes("--once")) startWebServer(config, store);
await cycle();
if (!process.argv.includes("--once")) {
  setInterval(() => cycle().catch((error) => console.error(error.message)), config.pollMinutes * 60_000);
  console.log(`CashClaw started; polling every ${config.pollMinutes} minutes`);
}
