import test from "node:test";
import assert from "node:assert/strict";
import { detectRewardAnomaly, evaluateRewardTrust } from "../src/bounties/reward-trust/index.js";
import { evaluateBountyFeasibility, qualifiesForSmallBountyFastLane } from "../src/bounties/feasibility.js";

const now = Date.parse("2026-08-12T00:00:00Z");
test("fresh low-value unpaid bounty can be trusted enough to investigate", () => {
  const result = evaluateRewardTrust({ advertisedAmount: 20, comparableMedian: 40, fundingStatus: "unpaid", rewardCreatedAt: "2026-08-11", issueCreatedAt: "2026-08-11", lastActivityAt: "2026-08-11", solverCount: 1, repositoryQuality: "established" }, now);
  assert.ok(result.rewardTrustScore >= 25);
  assert.equal(result.anomaly.level, "normal");
});

test("old unpaid inactive bounty receives an aging penalty", () => {
  const result = evaluateRewardTrust({ advertisedAmount: 50, comparableMedian: 50, fundingStatus: "unpaid", rewardCreatedAt: "2024-01-01", issueCreatedAt: "2024-01-01", lastActivityAt: "2024-01-01", solverCount: 3 }, now);
  assert.ok(result.rewardTrustScore < 20);
});

test("extreme unverified reward is capped and sent to manual review", () => {
  const result = evaluateRewardTrust({ advertisedAmount: 1260914, comparableMedian: 50, fundingStatus: "unpaid", solverCount: 0 }, now);
  assert.equal(result.anomaly.level, "extreme");
  assert.equal(result.manualReview, true);
  assert.ok(result.effectiveRewardForScoring < result.advertisedReward);
  assert.equal(detectRewardAnomaly({ advertisedAmount: Infinity }).level, "normal");
});

test("fast lane accepts only low-risk trusted small rewards", () => {
  const opportunity = { bounty: { advertisedAmount: 20 }, rewardTrust: { advertisedReward: 20, rewardTrustScore: 80, paymentProbability: 0.7 }, title: "Fix test", description: "Reproduce a small bug. Test included." };
  const feasibility = evaluateBountyFeasibility(opportunity);
  assert.equal(qualifiesForSmallBountyFastLane(opportunity, feasibility), true);
});
