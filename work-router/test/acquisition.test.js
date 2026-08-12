import test from "node:test";
import assert from "node:assert/strict";
import { canSubmitPaidProposal } from "../src/domain/opportunity.js";
import { calculateAcquisitionEconomics, safeMoney } from "../src/bounties/economics.js";

test("paid actions stay blocked unless a matching individual approval exists", () => {
  const source = { id: "upwork", opportunityId: "task-1", acquisitionModel: "paid" };
  assert.equal(canSubmitPaidProposal({ source, policy: { allowPaidProposals: false, maxPaidProposalCost: 0 } }), false);
  assert.equal(canSubmitPaidProposal({ source, policy: { allowPaidProposals: true, maxPaidProposalCost: 5 }, approval: { approved: true, source: "upwork", opportunityId: "task-1", cost: 2 } }), true);
});

test("acquisition economics includes expected attempts and guards malformed money", () => {
  const result = calculateAcquisitionEconomics({ expectedRevenue: 100, proposalCost: 2, winProbability: 0.25, completionProbability: 0.8, paymentProbability: 0.5 });
  assert.equal(result.expectedAttemptsToWin, 4);
  assert.equal(result.expectedAcquisitionCost, 8);
  assert.equal(result.expectedNetProfit, 92);
  assert.equal(result.riskAdjustedNetProfit, 36.8);
  assert.equal(safeMoney("Infinity"), 0);
  assert.equal(safeMoney(-2), 0);
});
