export const AcquisitionModel = Object.freeze({
  FREE: "free",
  INBOUND: "inbound",
  PAID: "paid",
  BOUNTY: "bounty",
  EXPERIMENTAL: "experimental",
});

export const acquisitionPriority = Object.freeze({
  free: 5,
  bounty: 4,
  inbound: 3,
  experimental: 2,
  paid: 1,
});

export const defaultCapabilities = Object.freeze({
  discover: true,
  readDetails: true,
  draftProposal: true,
  submitFreeProposal: false,
  submitPaidProposal: false,
  claimBounty: false,
  submitSolution: false,
});

export function normalizeAcquisitionModel(value) {
  return Object.values(AcquisitionModel).includes(value) ? value : AcquisitionModel.EXPERIMENTAL;
}

export function canSubmitPaidProposal({ source, policy, approval }) {
  if (normalizeAcquisitionModel(source?.acquisitionModel) !== AcquisitionModel.PAID) return true;
  if (!policy?.allowPaidProposals || policy.maxPaidProposalCost <= 0) return false;
  if (!approval?.approved || approval.source !== source.id || approval.opportunityId !== source.opportunityId) return false;
  return Number.isFinite(approval.cost) && approval.cost > 0 && approval.cost <= policy.maxPaidProposalCost;
}

export function rankByAcquisition(opportunity) {
  return acquisitionPriority[normalizeAcquisitionModel(opportunity.acquisitionModel)] || 0;
}
