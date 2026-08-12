import { safeMoney } from "../economics.js";

const clamp = (value, low = 0, high = 100) => Math.min(high, Math.max(low, value));
const daysSince = (date, now) => {
  const time = Date.parse(date || "");
  return Number.isFinite(time) ? Math.max(0, (now - time) / 86_400_000) : null;
};

export function detectRewardAnomaly(bounty = {}) {
  const advertisedAmount = safeMoney(bounty.advertisedAmount);
  const median = safeMoney(bounty.comparableMedian || bounty.repositoryMedian || bounty.sourceMedian || bounty.languageMedian || bounty.categoryMedian || 100);
  const rewardToMedianRatio = median > 0 ? advertisedAmount / median : 0;
  let level = "normal";
  let penalty = 0;
  if (rewardToMedianRatio >= 1_000) { level = "extreme"; penalty = 50; }
  else if (rewardToMedianRatio >= 100) { level = "high"; penalty = 30; }
  else if (rewardToMedianRatio >= 20) { level = "elevated"; penalty = 15; }
  return { level, penalty, rewardToMedianRatio, median }; 
}

export function calculatePaymentProbability(bounty, trustScore) {
  const funding = { escrowed: 0.9, prepaid: 0.82, pledged: 0.38, unpaid: 0.25, unknown: 0.18 }[bounty.fundingStatus] ?? 0.18;
  const history = bounty.paymentHistoryAvailable && bounty.successfulPaidRewards ? 0.1 : 0;
  return clamp(Math.round((funding + history + trustScore / 500) * 100) / 100, 0.02, 0.98);
}

export function evaluateRewardTrust(bounty = {}, now = Date.now()) {
  const anomaly = detectRewardAnomaly(bounty);
  const funding = bounty.fundingStatus || "unknown";
  const rewardAgeDays = daysSince(bounty.rewardCreatedAt, now);
  const issueAgeDays = daysSince(bounty.issueCreatedAt, now);
  const lastActivityDays = daysSince(bounty.lastActivityAt, now);
  let score = { escrowed: 30, prepaid: 25, pledged: 5, unpaid: 5, unknown: 0 }[funding] ?? 0;
  const reasons = [];
  if (["escrowed", "prepaid"].includes(funding)) reasons.push("Funding status is verifiable.");
  if (bounty.successfulPaidRewards) { score += 20; reasons.push("Provider or creator has payment history."); }
  if (funding === "unpaid" && rewardAgeDays !== null && rewardAgeDays > 180) { score -= 20; reasons.push("Unpaid reward is older than 180 days."); }
  if (issueAgeDays !== null && issueAgeDays <= 30 && (lastActivityDays === null || lastActivityDays <= 30)) { score += 10; reasons.push("Issue is fresh and active."); }
  if (issueAgeDays !== null && issueAgeDays > 730 && (lastActivityDays === null || lastActivityDays > 180)) { score -= 20; reasons.push("Issue is old and inactive."); }
  if (bounty.repositoryQuality === "established") score += 10;
  if (bounty.repositoryQuality === "suspicious") { score -= 15; reasons.push("Repository looks new or suspicious."); }
  const solvers = Number(bounty.solverCount);
  if (Number.isFinite(solvers) && solvers <= 1) score += 5;
  if (Number.isFinite(solvers) && solvers >= 5) { score -= 5; reasons.push("Many active solvers increase competition."); }
  score -= anomaly.penalty;
  if (anomaly.level !== "normal") reasons.push(`Reward anomaly: ${anomaly.level}.`);
  const rewardTrustScore = clamp(Math.round(score));
  const paymentProbability = calculatePaymentProbability(bounty, rewardTrustScore);
  const winProbability = clamp(Number(bounty.winProbability) || (solvers >= 5 ? 0.12 : solvers >= 2 ? 0.25 : 0.45), 0.02, 0.9);
  const advertisedReward = safeMoney(bounty.advertisedAmount);
  const trustedRewardCap = safeMoney(bounty.trustedRewardCap || anomaly.median * 10 || 1_000);
  const effectiveExpectedReward = advertisedReward * paymentProbability * winProbability;
  const effectiveRewardForScoring = Math.min(effectiveExpectedReward, trustedRewardCap);
  const manualReview = anomaly.level === "extreme" || rewardTrustScore < 20;
  return {
    advertisedReward,
    trustedRewardCap,
    effectiveExpectedReward: Math.round(effectiveExpectedReward * 100) / 100,
    effectiveRewardForScoring: Math.round(effectiveRewardForScoring * 100) / 100,
    rewardTrustScore,
    paymentProbability,
    winProbability,
    anomaly,
    rewardAgeDays: rewardAgeDays === null ? null : Math.round(rewardAgeDays),
    issueAgeDays: issueAgeDays === null ? null : Math.round(issueAgeDays),
    manualReview,
    reasons,
  };
}
