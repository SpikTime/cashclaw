import {
  DISCOVERY_ONLY_CAPABILITIES,
  type ConnectionTestResult,
  type DiscoveryResult,
  type RawOpportunity,
  type SourceCursor,
  type SourceHealth,
  type ValidationResult,
  type WorkSourceAdapter,
} from "./types.js";

export interface FakeSourceAdapterOptions {
  id?: string;
  opportunities?: RawOpportunity[];
}

export class FakeSourceAdapter implements WorkSourceAdapter {
  readonly id: string;
  readonly type = "fake";
  readonly capabilities = DISCOVERY_ONLY_CAPABILITIES;

  private readonly opportunities: RawOpportunity[];

  constructor(options: FakeSourceAdapterOptions = {}) {
    this.id = options.id ?? "fake-source";
    this.opportunities = [...(options.opportunities ?? [])];
  }

  async validateConfig(): Promise<ValidationResult> {
    return { valid: true, errors: [] };
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { ok: true, checkedAt: new Date().toISOString() };
  }

  async healthCheck(): Promise<SourceHealth> {
    return { status: "healthy", checkedAt: new Date().toISOString() };
  }

  async discover(cursor?: SourceCursor): Promise<DiscoveryResult> {
    const offset = parseCursor(cursor);
    const items = this.opportunities.slice(offset);

    return {
      items,
      nextCursor: { value: String(this.opportunities.length) },
    };
  }

  async getOpportunity(externalId: string): Promise<RawOpportunity | null> {
    return this.opportunities.find((item) => item.externalId === externalId) ?? null;
  }
}

function parseCursor(cursor?: SourceCursor): number {
  if (!cursor) return 0;

  const value = Number.parseInt(cursor.value, 10);
  if (!Number.isSafeInteger(value) || value < 0) return 0;
  return value;
}
