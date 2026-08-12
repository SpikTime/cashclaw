import fs from "node:fs";
import path from "node:path";

export function createStore(root = process.cwd()) {
  const base = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "CashClaw")
    : path.join(root, ".cashclaw-data");
  fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, "state.json");
  let state = { seen: [], jobs: [], llmDate: "", llmCount: 0, telegramOffset: 0 };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch {}
  const seen = new Set(state.seen);
  return {
    state,
    has(id) { return seen.has(id); },
    mark(id) { seen.add(id); state.seen = [...seen].slice(-5000); },
    addJob(job) { state.jobs.unshift(job); state.jobs = state.jobs.slice(0, 100); },
    getJob(id) { return state.jobs.find((item) => item.id === id); },
    updateJob(id, patch) {
      const job = state.jobs.find((item) => item.id === id);
      if (job) Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    },
    save() { fs.writeFileSync(file, JSON.stringify(state, null, 2)); },
  };
}

export function takeLlmQuota(store, limit, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  if (store.state.llmDate !== date) { store.state.llmDate = date; store.state.llmCount = 0; }
  if (store.state.llmCount >= limit) return false;
  store.state.llmCount += 1;
  return true;
}

export function summarizeBountyMoney(jobs = []) {
  const bounties = jobs.filter((job) => job.acquisitionModel === "bounty" && job.rewardTrust);
  return bounties.reduce((summary, job) => {
    summary.discovered += 1;
    summary.advertised += Number(job.rewardTrust.advertisedReward || 0);
    summary.potential += Number(job.rewardTrust.effectiveRewardForScoring || 0);
    if (job.moneyStatus === "claimed") summary.claimed += Number(job.rewardTrust.effectiveRewardForScoring || 0);
    if (job.moneyStatus === "paid") { summary.paid += Number(job.paymentAmount || 0); summary.rewardsPaid += 1; }
    return summary;
  }, { discovered: 0, advertised: 0, potential: 0, claimed: 0, paid: 0, rewardsPaid: 0 });
}
