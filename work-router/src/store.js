import fs from "node:fs";
import path from "node:path";
import { classifyOpportunity } from "./classifier.js";
import { scoreOpportunity } from "./scoring.js";

export const CURRENT_STATE_VERSION = 4;
const defaults = () => ({ version: CURRENT_STATE_VERSION, seen: [], jobs: [], opportunities: [], duplicateGroups: [], sources: [], outbox: [], cycles: [], maybeDigest: [], llmDate: "", llmCount: 0, telegramOffset: 0 });
export function migrateState(input = {}) {
  const previousVersion = Number(input?.version || 0);
  const state = { ...defaults(), ...(input && typeof input === "object" ? input : {}) };
  for (const key of ["seen", "jobs", "opportunities", "duplicateGroups", "sources", "outbox", "cycles", "maybeDigest"]) if (!Array.isArray(state[key])) state[key] = [];
  state.outbox = state.outbox.map((item) => item.status === "sending" ? { ...item, status: "retry", nextAttemptAt: new Date(0).toISOString() } : item);
  if (previousVersion < 4) state.opportunities = state.opportunities.map((item) => {
    const legacyScore = Number.isFinite(item.score) ? item.score : Number.isFinite(item.preliminaryScore) ? item.preliminaryScore : null;
    const classified = classifyOpportunity(item);
    return { ...scoreOpportunity(classified), ...(legacyScore == null ? {} : { legacyScore }) };
  });
  state.opportunities.sort((a, b) => Number(a.eligibility === "SUPPRESSED") - Number(b.eligibility === "SUPPRESSED") || Number(b.score || 0) - Number(a.score || 0));
  state.version = CURRENT_STATE_VERSION;
  return state;
}
function atomicWrite(file, value) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const handle = fs.openSync(temp, "w", 0o600);
  try { fs.writeFileSync(handle, value, "utf8"); fs.fsyncSync(handle); } finally { fs.closeSync(handle); }
  fs.renameSync(temp, file);
  try { const dir = fs.openSync(path.dirname(file), "r"); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); } } catch {}
}
export function createStore(root = process.cwd(), options = {}) {
  const base = options.direct ? root : process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "CashClaw") : path.join(root, ".cashclaw-data");
  fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, "state.json");
  let loaded = {}; try { loaded = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  const state = migrateState(loaded); const seen = new Set(state.seen);
  return { state, file, has(id) { return seen.has(id); }, mark(id) { seen.add(id); state.seen = [...seen].slice(-10000); }, addJob(job) { state.jobs.unshift(job); state.jobs = state.jobs.slice(0, 1000); }, getJob(id) { return state.jobs.find((item) => item.id === id); }, updateJob(id, patch) { const job = state.jobs.find((item) => item.id === id); if (job) Object.assign(job, patch, { updatedAt: new Date().toISOString() }); }, save() { atomicWrite(file, JSON.stringify(state, null, 2)); } };
}
export function takeLlmQuota(store, limit, now = new Date()) { const date = now.toISOString().slice(0, 10); if (store.state.llmDate !== date) { store.state.llmDate = date; store.state.llmCount = 0; } if (store.state.llmCount >= limit) return false; store.state.llmCount += 1; return true; }
export function summarizeBountyMoney(jobs = []) { const bounties = jobs.filter((job) => job.acquisitionModel === "bounty" && job.rewardTrust); return bounties.reduce((summary, job) => { summary.discovered += 1; summary.advertised += Number(job.rewardTrust.advertisedReward || 0); summary.potential += Number(job.rewardTrust.effectiveRewardForScoring || 0); if (job.moneyStatus === "claimed") summary.claimed += Number(job.rewardTrust.effectiveRewardForScoring || 0); if (job.moneyStatus === "paid") { summary.paid += Number(job.paymentAmount || 0); summary.rewardsPaid += 1; } return summary; }, { discovered: 0, advertised: 0, potential: 0, claimed: 0, paid: 0, rewardsPaid: 0 }); }
