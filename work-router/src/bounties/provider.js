export function createBountyProviderAdapter({ id, discoverRewards, getReward, getRewardHistory, getContributorHistory, getSolverStatus }) {
  if (!id || typeof discoverRewards !== "function" || typeof getReward !== "function") throw new Error("A bounty provider requires id, discoverRewards, and getReward.");
  return Object.freeze({ id, discoverRewards, getReward, getRewardHistory, getContributorHistory, getSolverStatus, async claimReward() { return { ok: false, reason: "Manual approval is required; automatic claims are disabled." }; } });
}
