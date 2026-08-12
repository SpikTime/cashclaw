import { createBountyProviderAdapter } from "./provider.js";

export function normalizeOpireReward(raw = {}) {
  return {
    externalRewardId: String(raw.id || raw.issueUrl || ""),
    provider: "opire",
    advertisedAmount: Number(raw.amount) || 0,
    currency: raw.currency || "USD",
    fundingStatus: raw.fundingStatus || "unknown",
    paymentGuaranteed: Boolean(raw.paymentGuaranteed),
    rewardCount: Array.isArray(raw.rewards) ? raw.rewards.length : Number(raw.rewardCount || 0),
    contributors: Array.isArray(raw.contributors) ? raw.contributors.slice(0, 100) : [],
    solverCount: Number(raw.solverCount || 0),
    claimRequired: true,
    claimAvailable: Boolean(raw.claimAvailable),
    payoutConditions: Array.isArray(raw.payoutConditions) ? raw.payoutConditions.slice(0, 20) : [],
    rewardCreatedAt: raw.createdAt,
    lastRewardAddedAt: raw.lastRewardAddedAt,
    paymentHistoryAvailable: Boolean(raw.paymentHistoryAvailable),
    issueCreatedAt: raw.issueCreatedAt,
    lastActivityAt: raw.lastActivityAt,
    repositoryQuality: raw.repositoryQuality || "unknown",
  };
}

export function createOpireManualAdapter(importRewards = []) {
  const rewards = importRewards.map(normalizeOpireReward);
  return createBountyProviderAdapter({
    id: "opire-manual-import",
    async discoverRewards() { return { source: "manual-import", rewards }; },
    async getReward(externalRewardId) { return rewards.find((reward) => reward.externalRewardId === externalRewardId) || null; },
  });
}
