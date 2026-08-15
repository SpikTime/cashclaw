# Scoring

Acquisition priority is free, bounty, inbound, experimental, then paid. It is only one input: skill match, reward trust, anomaly penalty and risk-adjusted net profit affect final ordering.

`expectedAttemptsToWin = 1 / winProbability`.

`expectedAcquisitionCost = proposalCost * expectedAttemptsToWin`.

`expectedNetProfit = expectedRevenue - fees - expectedAcquisitionCost - LLM/API/compute/revision/risk costs`.

`riskAdjustedNetProfit = expectedNetProfit * completionProbability * paymentProbability`.

For bounties, `effectiveExpectedReward = advertisedReward * paymentProbability * winProbability`, capped by `trustedRewardCap`. Extreme anomalies are manually reviewed.
