const has = (text, pattern) => pattern.test(text || "");

export function evaluateBountyFeasibility(opportunity = {}) {
  const text = `${opportunity.title || ""}\n${opportunity.description || ""}`.toLowerCase();
  const hardwareRequired = has(text, /gpu|nvidia|cuda|hardware|physical device/);
  const credentialsRequired = has(text, /credential|api key|private key|login|access token/);
  const specialEnvironmentRequired = has(text, /macos|windows only|ios device|docker|kubernetes/);
  const unclearScope = text.length < 80 || has(text, /contact me|details later|urgent help/);
  const technicalRisk = Math.min(100, (hardwareRequired ? 35 : 0) + (credentialsRequired ? 25 : 0) + (specialEnvironmentRequired ? 15 : 0) + (unclearScope ? 25 : 0));
  const estimatedAgentTime = technicalRisk > 60 ? 8 : technicalRisk > 30 ? 3 : 1;
  const overallFeasibilityScore = 100 - technicalRisk;
  return {
    rootCauseHypothesis: unclearScope ? "Scope needs clarification." : "Likely isolated implementation or bug fix.",
    reproductionStatus: unclearScope ? "blocked" : "likely",
    expectedFilesToChange: unclearScope ? [] : ["source files", "tests"],
    estimatedLOC: unclearScope ? null : technicalRisk > 30 ? 200 : 80,
    testsAvailable: has(text, /test|spec|ci/),
    newTestsRequired: !has(text, /test|spec/),
    specialEnvironmentRequired,
    hardwareRequired,
    credentialsRequired,
    estimatedAgentTime,
    estimatedLLMCost: Math.round(estimatedAgentTime * 0.2 * 100) / 100,
    technicalRisk,
    competitionRisk: Number(opportunity.bounty?.solverCount || 0) >= 5 ? 70 : 20,
    paymentRisk: 100 - Number(opportunity.rewardTrust?.paymentProbability || 0) * 100,
    maintainerAcceptanceRisk: unclearScope ? 60 : 25,
    overallFeasibilityScore,
    recommendation: technicalRisk > 65 ? "skip" : unclearScope ? "investigate" : "solve",
  };
}

export function qualifiesForSmallBountyFastLane(opportunity, feasibility) {
  const reward = Number(opportunity.rewardTrust?.advertisedReward || opportunity.bounty?.advertisedAmount || 0);
  return reward >= 10 && reward <= 100 && feasibility.overallFeasibilityScore >= 70 && feasibility.competitionRisk <= 30 && !feasibility.hardwareRequired && !feasibility.credentialsRequired && opportunity.rewardTrust?.rewardTrustScore >= 55;
}
