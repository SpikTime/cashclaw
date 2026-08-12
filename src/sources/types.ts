export interface SourceCapabilities {
  discovery: boolean;
  readDetails: boolean;
  readMessages: boolean;
  sendMessages: boolean;
  submitProposal: boolean;
  acceptWork: boolean;
  submitWork: boolean;
  paymentTracking: boolean;
  feedbackTracking: boolean;
  webhooks: boolean;
  polling: boolean;
  manualApprovalRequired: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
  checkedAt: string;
}

export interface SourceHealth {
  status: "healthy" | "degraded" | "unavailable";
  message?: string;
  checkedAt: string;
}

export interface SourceCursor {
  value: string;
}

export interface RawOpportunity {
  externalId: string;
  externalUrl?: string;
  title: string;
  description: string;
  rawPayload: unknown;
  publishedAt?: string;
  updatedAt?: string;
}

export interface DiscoveryResult {
  items: RawOpportunity[];
  nextCursor?: SourceCursor;
}

export interface SourceMessage {
  externalId: string;
  author?: string;
  body: string;
  sentAt: string;
}

export interface ProposalPayload {
  body: string;
  price?: {
    amount: number;
    currency: string;
  };
}

export interface DeliverablePayload {
  summary: string;
  artifactReferences: string[];
}

export interface ActionResult {
  ok: boolean;
  externalActionId?: string;
  message?: string;
}

export interface PaymentStatus {
  status: "unknown" | "pending" | "paid" | "failed";
  amount?: number;
  currency?: string;
}

export interface FeedbackResult {
  rating?: number;
  comments?: string;
  receivedAt?: string;
}

export interface WorkSourceAdapter {
  readonly id: string;
  readonly type: string;
  readonly capabilities: SourceCapabilities;

  validateConfig(): Promise<ValidationResult>;
  testConnection(): Promise<ConnectionTestResult>;
  healthCheck(): Promise<SourceHealth>;

  discover(cursor?: SourceCursor): Promise<DiscoveryResult>;
  getOpportunity(externalId: string): Promise<RawOpportunity | null>;

  getMessages?(externalId: string): Promise<SourceMessage[]>;
  sendMessage?(externalId: string, message: string): Promise<ActionResult>;
  createProposal?(
    externalId: string,
    proposal: ProposalPayload,
  ): Promise<ActionResult>;
  acceptWork?(externalId: string): Promise<ActionResult>;
  submitDeliverable?(
    externalId: string,
    deliverable: DeliverablePayload,
  ): Promise<ActionResult>;
  getPaymentStatus?(externalId: string): Promise<PaymentStatus>;
  getFeedback?(externalId: string): Promise<FeedbackResult>;
}

export const DISCOVERY_ONLY_CAPABILITIES: SourceCapabilities = Object.freeze({
  discovery: true,
  readDetails: true,
  readMessages: false,
  sendMessages: false,
  submitProposal: false,
  acceptWork: false,
  submitWork: false,
  paymentTracking: false,
  feedbackTracking: false,
  webhooks: false,
  polling: true,
  manualApprovalRequired: true,
});
