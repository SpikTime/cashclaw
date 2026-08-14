# Multi-Source Throughput Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved resilient, free-first multi-source router in `work-router/`, including public Telegram ingestion, fair local-to-deep analysis, reliable notifications, analytics, UI controls, and live verification.

**Architecture:** Source adapters emit normalized records into a deterministic local pipeline. Versioned JSON persistence owns sources, opportunities, cycle summaries, and an idempotent notification outbox; Claude is reserved for source-aware deep-analysis slots. The authenticated Mini App exposes safe source controls and operational state.

**Tech Stack:** Node.js 20+ ESM, built-in `fetch`, `node:test`, local JSON state, Telegram Bot API, public `t.me/s` HTML, vanilla HTML/CSS/JavaScript.

---

## File map

- Create `work-router/src/resilience.js`: typed failures, timeout/retry/backoff helpers.
- Modify `work-router/src/store.js`: versioned state, migrations, atomic persistence, outbox operations.
- Create `work-router/src/outbox.js`: persistent delivery worker and retry policy.
- Create `work-router/src/classifier.js`: classification, safety, relevance, freshness, extraction.
- Create `work-router/src/budget.js`: deterministic currency/range parser.
- Create `work-router/src/dedupe.js`: exact and near-duplicate grouping.
- Create `work-router/src/scheduler.js`: source-aware deep-slot allocation.
- Create `work-router/src/source-registry.js`: default registry, mutations, health and quality.
- Create `work-router/src/telegram-public.js`: public Telegram adapter and parser.
- Create `work-router/src/pipeline.js`: isolated discovery cycle orchestration and analytics.
- Create `work-router/src/notifications.js`: bands, formatting, fast alert, digest, bounty review.
- Modify `work-router/src/config.js`: new safe configuration.
- Modify `work-router/src/index.js`: compose modules without cross-component failure propagation.
- Modify `work-router/src/web.js`: authenticated source/job/cycle APIs.
- Modify `work-router/public/index.html`, `app.js`, `app.css`: Sources and enriched Jobs views.
- Create `work-router/src/report.js` and `work-router/scripts/source-24h-report.mjs`: observation report.
- Add focused tests in `work-router/test/` for each new module and required failure paths.

### Task 1: Resilience and versioned atomic state

**Files:** `work-router/src/resilience.js`, `work-router/src/store.js`, `work-router/test/resilience.test.js`, `work-router/test/store.test.js`

- [ ] Write failing tests for typed source errors, bounded retry/jitter, migration of legacy state, recovery of `sending` outbox entries, and atomic save.

```js
test("migrates legacy state without losing jobs", () => {
  const state = migrateState({ jobs: [{ id: "old" }], seen: ["x"] });
  assert.equal(state.version, CURRENT_STATE_VERSION);
  assert.equal(state.jobs[0].id, "old");
  assert.deepEqual(state.outbox, []);
});
```

- [ ] Run `npm test -- test/resilience.test.js test/store.test.js`; expect the new imports/tests to fail.
- [ ] Implement `SourceError`, `withRetry(operation, options)`, `migrateState`, safe defaults, temp-file write, file sync, and same-directory atomic replace.
- [ ] Run `npm test && npm run typecheck && npm run build`; expect all tests/checks to pass.
- [ ] Commit as `feat: add resilient versioned local state`.

### Task 2: Persistent Telegram outbox

**Files:** `work-router/src/outbox.js`, `work-router/src/store.js`, `work-router/src/telegram.js`, `work-router/test/outbox.test.js`

- [ ] Write failing tests for save-before-send, 429 retry, timeout retry, idempotency, sent suppression, dead-letter exhaustion, and restart recovery.

```js
const first = enqueueNotification(store, { opportunityId: "o1", kind: "good", chatId: "1", text: "x" });
const second = enqueueNotification(store, { opportunityId: "o1", kind: "good", chatId: "1", text: "x" });
assert.equal(first.id, second.id);
assert.equal(store.state.outbox.length, 1);
```

- [ ] Run `npm test -- test/outbox.test.js`; expect failure.
- [ ] Implement deterministic keys and `pending/sending/retry/sent/dead`, respect Telegram `retry_after`, bounded exponential backoff, jitter, and timeout.
- [ ] Run the full test/typecheck/build gate.
- [ ] Commit as `feat: add persistent notification outbox`.

### Task 3: Local classification, extraction, budget, and safety

**Files:** `work-router/src/classifier.js`, `work-router/src/budget.js`, `work-router/test/classifier.test.js`, `work-router/test/budget.test.js`

- [ ] Write table-driven failing tests for all ten classifications, positive/negative signals, unsafe rejection, skills, contacts, deadlines, freshness, and every required budget example.

```js
assert.deepEqual(parseBudget("Бюджет $500-$1000"), {
  min: 500, max: 1000, currency: "USD", confidence: "high", raw: "$500-$1000"
});
assert.equal(classifyMessage("Ищу работу, вот моё резюме").classification, "SELF_PROMOTION");
```

- [ ] Run the focused tests and verify failure.
- [ ] Implement deterministic extraction and weighted preliminary score; never synthesize a budget.
- [ ] Run the full gate.
- [ ] Commit as `feat: add local opportunity classification`.

### Task 4: Cross-source deduplication

**Files:** `work-router/src/dedupe.js`, `work-router/test/dedupe.test.js`

- [ ] Write failing exact URL/hash and near-duplicate tests using contact, budget, publication window, token similarity, and shingles.
- [ ] Run the focused test and verify failure.
- [ ] Implement canonical URLs, normalized hashes, bounded similarity, and source-link merging that emits `foundInSources`.
- [ ] Run the full gate.
- [ ] Commit as `feat: add cross-source deduplication`.

### Task 5: Source-aware scheduling and two-stage quotas

**Files:** `work-router/src/scheduler.js`, `work-router/src/config.js`, `work-router/test/scheduler.test.js`, `work-router/test/config.test.js`

- [ ] Write failing fairness, capacity, ranking, and deep-quota tests.

```js
const selected = allocateDeepSlots(candidates, 4);
assert.deepEqual(new Set(selected.map(x => x.source)), new Set(["kwork", "fl", "github", "telegram:a"]));
```

- [ ] Run focused tests and verify failure.
- [ ] Implement one-slot-per-source when capacity permits, then rank by preliminary score, freshness, quality, budget, and skill match. Add `SOURCE_MAX_CHEAP_LLM_PER_CYCLE=40` and `SOURCE_MAX_DEEP_LLM_PER_CYCLE=12` with legacy fallback.
- [ ] Run the full gate.
- [ ] Commit as `feat: add source-aware analysis pipeline`.

### Task 6: Telegram source registry and public adapter

**Files:** `work-router/src/source-registry.js`, `work-router/src/telegram-public.js`, `work-router/test/source-registry.test.js`, `work-router/test/telegram-public.test.js`

- [ ] Write failing tests for default channels, username validation, public HTML parsing, bounded response, 429, timeout, unavailable/manual state, degraded recovery, and source message URLs.
- [ ] Run focused tests and verify failure.
- [ ] Implement configurable registry plus read-only `https://t.me/s/<username>` fetch/parser. Do not implement login, MTProto, proxy, CAPTCHA, or identity rotation.
- [ ] Run the full gate.
- [ ] Commit as `feat: add public telegram ingestion`.

### Task 7: Pipeline, quality analytics, and failure isolation

**Files:** `work-router/src/pipeline.js`, `work-router/src/index.js`, `work-router/src/source-registry.js`, `work-router/test/pipeline.test.js`

- [ ] Write failing tests proving Telegram/Kwork/FL/GitHub/Claude/delivery failures do not stop other components, and verify all requested cycle/source counters.
- [ ] Run focused tests and verify failure.
- [ ] Compose adapters, local filtering, dedupe, fair allocation, deep analysis, degraded source state, conservative quality scoring after minimum sample, and persisted cycle summaries.
- [ ] Run the full gate.
- [ ] Commit as `feat: isolate multi-source discovery pipeline`.

### Task 8: Notification bands, digest, fast alert, and bounty review

**Files:** `work-router/src/notifications.js`, `work-router/src/config.js`, `work-router/test/notifications.test.js`

- [ ] Write failing boundary tests for HOT/GOOD/MAYBE/silent, one MAYBE digest, preliminary alert criteria, and low-trust bounty manual review.
- [ ] Run focused tests and verify failure.
- [ ] Implement configurable thresholds and outbox creation. Mark fast alerts as preliminary and never label low-trust bounties GOOD.
- [ ] Run the full gate.
- [ ] Commit as `feat: add notification bands and digests`.

### Task 9: Authenticated Mini App controls and enriched jobs

**Files:** `work-router/src/web.js`, `work-router/public/index.html`, `work-router/public/app.js`, `work-router/public/app.css`, `work-router/test/web.test.js`

- [ ] Write failing API tests for listing/adding/testing/running/enabling/disabling sources, malformed usernames, missing Telegram init data, and secret-free responses.
- [ ] Run focused tests and verify failure.
- [ ] Add authenticated `/api/sources`, `/api/sources/:username/*`, `/api/cycles`, and enriched `/api/jobs`; add Sources and cycle-summary UI with loading/error states.
- [ ] Run the full gate and browser smoke test.
- [ ] Commit as `feat: add mini app source controls`.

### Task 10: Report, configuration, security, live verification, and delivery

**Files:** `work-router/src/report.js`, `work-router/scripts/source-24h-report.mjs`, `work-router/docs/SOURCE_24H_REPORT.md`, `work-router/.env.example`, `work-router/README.md`, supporting tests.

- [ ] Write failing report tests covering rankings, rates, throughput, failures, recommendations, and no automatic priority mutation.
- [ ] Implement deterministic report generation from persisted observation windows and document every new configuration value.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run validate:skills`; expect success.
- [ ] Run security checks for secret leakage, unsafe HTML, URL validation, response bounds, timeouts, rate limits, forbidden Telegram mechanisms, paid proposals, and automatic customer contact.
- [ ] Run a real `npm run once` discovery cycle with actual configured credentials, record measured channel/source/cycle results, and generate the report without fabricated values.
- [ ] Synchronize verified `work-router/` files to the active local runtime without overwriting `.env`, restart it, and confirm Mini App/outbox health.
- [ ] Commit documentation/live-report changes, push `codex/multi-source-work-router`, and update the existing Draft PR rather than opening a new PR.
