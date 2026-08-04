import { describe, expect, it } from "vitest";
import { FakeSourceAdapter } from "../../src/sources/fake.js";
import type { RawOpportunity } from "../../src/sources/types.js";

const opportunity: RawOpportunity = {
  externalId: "job-1",
  title: "Build a TypeScript integration",
  description: "Create and test a source adapter.",
  rawPayload: { id: "job-1" },
  publishedAt: "2026-08-04T10:00:00.000Z",
};

describe("WorkSourceAdapter contract", () => {
  it("reports configuration, connection, and health independently", async () => {
    const adapter = new FakeSourceAdapter({ opportunities: [opportunity] });

    await expect(adapter.validateConfig()).resolves.toEqual({ valid: true, errors: [] });
    await expect(adapter.testConnection()).resolves.toMatchObject({ ok: true });
    await expect(adapter.healthCheck()).resolves.toMatchObject({ status: "healthy" });
  });

  it("discovers each opportunity once and advances an opaque cursor", async () => {
    const adapter = new FakeSourceAdapter({ opportunities: [opportunity] });

    const first = await adapter.discover();
    const second = await adapter.discover(first.nextCursor);

    expect(first.items).toEqual([opportunity]);
    expect(first.nextCursor).toEqual({ value: "1" });
    expect(second.items).toEqual([]);
    expect(second.nextCursor).toEqual(first.nextCursor);
  });

  it("returns an opportunity by its external identity", async () => {
    const adapter = new FakeSourceAdapter({ opportunities: [opportunity] });

    await expect(adapter.getOpportunity("job-1")).resolves.toEqual(opportunity);
    await expect(adapter.getOpportunity("missing")).resolves.toBeNull();
  });

  it("does not expose action methods when their capabilities are disabled", () => {
    const adapter = new FakeSourceAdapter({ opportunities: [opportunity] });

    expect(adapter.capabilities.discovery).toBe(true);
    expect(adapter.capabilities.submitProposal).toBe(false);
    expect(adapter.createProposal).toBeUndefined();
    expect(adapter.submitDeliverable).toBeUndefined();
  });
});
