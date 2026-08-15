import test from "node:test";
import assert from "node:assert/strict";
import { createOpireManualAdapter, normalizeOpireReward } from "../src/bounties/opire.js";
import { summarizeBountyMoney } from "../src/store.js";

test("Opire manual adapter imports reward data and never claims automatically", async () => {
  const adapter = createOpireManualAdapter([{ id: "r1", amount: "20", issueUrl: "https://github.com/a/b/issues/1" }]);
  assert.equal((await adapter.discoverRewards()).rewards[0].advertisedAmount, 20);
  assert.equal((await adapter.claimReward("r1")).ok, false);
  assert.equal(normalizeOpireReward({ amount: "bad" }).advertisedAmount, 0);
});

test("bounty analytics never treats advertised or potential money as paid revenue", () => {
  const result = summarizeBountyMoney([{ acquisitionModel: "bounty", rewardTrust: { advertisedReward: 100, effectiveRewardForScoring: 25 }, moneyStatus: "potential" }]);
  assert.deepEqual(result, { discovered: 1, advertised: 100, potential: 25, claimed: 0, paid: 0, rewardsPaid: 0 });
});
