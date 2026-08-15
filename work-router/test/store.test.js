import test from "node:test";
import assert from "node:assert/strict";
import { takeLlmQuota } from "../src/store.js";

test("takeLlmQuota enforces and resets the daily limit", () => {
  const store = { state: { llmDate: "", llmCount: 0 } };
  assert.equal(takeLlmQuota(store, 1, new Date("2026-08-05T10:00:00Z")), true);
  assert.equal(takeLlmQuota(store, 1, new Date("2026-08-05T11:00:00Z")), false);
  assert.equal(takeLlmQuota(store, 1, new Date("2026-08-06T10:00:00Z")), true);
});
