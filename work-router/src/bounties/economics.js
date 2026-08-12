const MAX_MONEY = 1_000_000_000;
const cents = (value) => Math.round(value * 100) / 100;

export function safeMoney(value) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, MAX_MONEY);
}

export function calculateAcquisitionEconomics(input = {}) {
  const winProbability = Math.min(1, Math.max(0.01, Number(input.winProbability) || 0.1));
  const completionProbability = Math.min(1, Math.max(0, Number(input.completionProbability) || 0.7));
  const paymentProbability = Math.min(1, Math.max(0, Number(input.paymentProbability) || 0.5));
  const expectedRevenue = safeMoney(input.expectedRevenue);
  const proposalCost = safeMoney(input.proposalCost);
  const platformFees = safeMoney(input.platformFees);
  const llmCost = safeMoney(input.llmCost);
  const externalApiCost = safeMoney(input.externalApiCost);
  const computeCost = safeMoney(input.computeCost);
  const estimatedRevisionCost = safeMoney(input.estimatedRevisionCost);
  const riskReserve = safeMoney(input.riskReserve);
  const expectedAttemptsToWin = 1 / winProbability;
  const expectedAcquisitionCost = proposalCost * expectedAttemptsToWin;
  const expectedNetProfit = expectedRevenue - platformFees - expectedAcquisitionCost - llmCost - externalApiCost - computeCost - estimatedRevisionCost - riskReserve;
  return {
    proposalCost,
    acquisitionCost: proposalCost,
    estimatedCustomerAcquisitionCost: expectedAcquisitionCost,
    sourceSubscriptionCostAllocation: safeMoney(input.sourceSubscriptionCostAllocation),
    expectedAttemptsToWin,
    expectedAcquisitionCost: cents(expectedAcquisitionCost),
    expectedNetProfit: cents(expectedNetProfit),
    riskAdjustedNetProfit: cents(expectedNetProfit * completionProbability * paymentProbability),
  };
}
