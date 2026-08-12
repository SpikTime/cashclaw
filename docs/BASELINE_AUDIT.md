# CashClaw baseline audit

Date: 2026-08-04

Audited revision: `fb5974ec0f3840ecdd973d20cd74a0735f62289c`

Target branch: `codex/multi-source-work-router`

## Executive summary

CashClaw is a compact TypeScript modular monolith built around one Moltlaunch-specific
task type and one in-process scheduler. Its strongest reusable parts are the provider-
neutral LLM loop, the tool abstraction, memory search, feedback/study flow, and React
dashboard. The principal architectural constraint is that discovery, analysis, external
actions, execution, and delivery are currently coupled through Moltlaunch task states and
LLM tool calls.

The multi-source router should evolve this codebase instead of replacing it. Moltlaunch
will move behind a source-adapter contract, while the current loop and user experience are
kept available through a compatibility layer. The first implementation boundary must be
the domain contract plus policy/approval controls; adding more sources before that would
multiply unsafe direct-action paths.

No production credentials, wallets, marketplace actions, messages, payments, or external
deployments were used during this audit.

## Repository and toolchain

| Item | Baseline |
| --- | --- |
| Package | `cashclaw-agent@0.1.0`, MIT |
| Runtime | Node.js; bundle target is Node 20 |
| Audit environment | Node `22.18.0`, npm `10.9.3`, Windows |
| Package manager | npm, selected by `package-lock.json` |
| Lockfile | npm lockfile v3, committed |
| Source | TypeScript ESM, strict mode |
| Backend bundle | tsup, one ESM CLI entry |
| Dashboard | React 19, Vite 6, Tailwind 4 |
| Tests | Vitest 2; one test file with seven loop tests |
| Persistence | JSON and Markdown files under `~/.cashclaw/` |
| Docker | No Dockerfile or Compose configuration exists |
| Lint | No lint script or lint configuration exists |

Dependencies were installed with `npm ci --ignore-scripts`. The lockfile identifies
install scripts for esbuild-family packages; they were not executed for the audit.
Despite this, typecheck, tests, and both builds passed in the audit environment.

## Baseline command results

| Check | Command | Exit | Duration | Result |
| --- | --- | ---: | ---: | --- |
| Lint | not available | n/a | n/a | `package.json` has no `lint` script |
| Typecheck | `npm run typecheck` | 0 | 2.5 s | Passed |
| Tests | `npm test` | 0 | 2.3 s | 1 file, 7 tests passed; Vitest reported 426 ms |
| CLI build | `npm run build` | 0 | 1.3 s | Passed; `dist/index.js` 74.72 KB |
| Full build | `npm run build:all` | 0 | 3.0 s | Passed; CLI and dashboard built |

These are baseline results before source changes. The missing lint command is recorded,
not synthesized. Adding linting should be a separate dependency and tooling decision.

## Dependency audit

`npm audit --json` exited non-zero and reported 10 existing findings:

- 1 critical: Vitest arbitrary file read/execution when its UI server is exposed;
- 4 high: Vite, PostCSS, Picomatch, and `ws` advisories;
- 4 moderate: esbuild/Vite-node/Vitest-mocker and `viem` through `ws`;
- 1 low: Babel source-map file-read advisory.

The Vitest/Vite/PostCSS findings are primarily development/build-path risks, but remain
relevant on a developer workstation. `ws` is a direct runtime dependency and its denial-
of-service advisory is potentially reachable through the Moltlaunch WebSocket client.
No automated remediation was applied. In particular, `npm audit fix --force` was not run.
Upgrades require a separate compatibility review because the suggested Vitest fix is a
major-version change.

## Current architecture map

### Entry points and processes

- `src/index.ts` starts the agent HTTP server, opens the local dashboard, and installs
  SIGINT/SIGTERM handlers.
- `src/agent.ts` is a 739-line combined HTTP server, API router, setup controller,
  dashboard host, operator-chat handler, and composition root.
- `src/heartbeat.ts` owns the in-memory scheduler, WebSocket reconnect loop, polling,
  task de-duplication by task/status, feedback capture, and study scheduling.
- The application is a single Node.js process. There is no worker process, durable queue,
  database transaction boundary, or multi-instance coordination.

### Moltlaunch lifecycle

- `src/moltlaunch/cli.ts` wraps the `mltl` executable with `execFile`, JSON parsing, and
  fixed timeouts. Agent lookup additionally uses the Moltlaunch REST API.
- `src/moltlaunch/types.ts` defines the only task and lifecycle model.
- `src/heartbeat.ts` receives tasks over WebSocket and polling, suppresses repeated
  task/status combinations in memory, and invokes the LLM loop.
- `src/tools/marketplace.ts` exposes read, quote, decline, submit, message, bounty browse,
  and bounty claim operations directly to the LLM.

### LLM and tool-use loop

- `src/llm/index.ts` implements Anthropic, OpenAI, and OpenRouter through raw `fetch`.
- `src/loop/index.ts` is provider-neutral and supports multi-turn tool use, a configurable
  maximum turn count, result propagation, and token accumulation.
- `src/tools/registry.ts` selects base tools and optional AgentCash tools, then dispatches
  by tool name.
- Tool inputs have LLM-facing JSON schemas, but runtime enforcement is mostly manual string
  checks. There is no central runtime schema validator or policy decision point.

### Memory, feedback, and study

- Knowledge, feedback, and chat are bounded JSON arrays stored under `~/.cashclaw/`.
- Writes use a temporary file plus rename for basic atomic replacement.
- `src/memory/search.ts` builds an in-memory MiniSearch index over knowledge and feedback,
  with temporal decay.
- Completed Moltlaunch tasks feed ratings into feedback memory.
- Idle study sessions rotate between feedback analysis, specialty research, and simulated
  practice, then persist an LLM-generated knowledge entry.

### Dashboard, API, and hot reload

- The local HTTP server provides setup, status, tasks, logs, config, statistics, memory,
  feedback, start/stop, chat, AgentCash, price, and registration endpoints.
- React pages cover setup, monitor, tasks, chat, and settings.
- Configuration updates are saved to disk and replace the live configuration reference;
  heartbeat instances are restarted when required. This is configuration hot reload, not
  source-code hot reload.
- API keys are masked in configuration responses, but the server has no authentication or
  authorization layer.

### AgentCash

- AgentCash is opt-in through configuration and wallet auto-detection.
- Calls use `npx agentcash`, making a tool invocation capable of package resolution as well
  as paid external requests.
- A hostname allowlist blocks obvious arbitrary-domain calls, but there is no DNS/IP pinning,
  redirect policy, per-call approval, durable cost ledger, or budget reservation.

## Persistence model

Current persistent files are:

- `cashclaw.json`: configuration and plaintext LLM API key;
- `knowledge.json`: last 50 knowledge entries;
- `feedback.json`: last 100 feedback entries;
- `chat.json`: last 100 operator/agent messages;
- `logs/YYYY-MM-DD.md`: append-only activity text.

The atomic rename pattern reduces partial-file corruption but does not provide relational
integrity, queries, migrations, concurrent-writer control, idempotency, or durable workflow
recovery. Scheduler and de-duplication state are lost on restart.

## Security baseline and trust boundaries

### Trust boundaries

1. Moltlaunch REST, WebSocket, CLI output, messages, attachments, and task text.
2. Operator HTTP requests and browser-rendered content.
3. LLM input and output, including tool names and arguments.
4. Local subprocesses (`mltl`, `npx agentcash`, browser opener).
5. External LLM and AgentCash endpoints.
6. Local configuration, wallet files, memory, and logs.

### Existing safeguards

- Subprocesses use `execFile` with argument arrays rather than a shell command string.
- Moltlaunch and AgentCash calls have timeouts.
- AgentCash hostnames use an allowlist.
- JSON body reads have a size guard.
- The LLM loop has a turn limit.
- Config responses mask the API key.
- Several memory writes use temporary-file replacement.
- React escapes text by default and no `dangerouslySetInnerHTML` use was found.

### Material gaps

- Task descriptions and messages are injected into prompts without an explicit untrusted-
  content envelope or prompt-injection analysis.
- LLM-selected marketplace and paid tools execute without a central capability, policy,
  approval, or cost-reservation check.
- `autoQuote` and `autoWork` default to enabled in configuration.
- API keys are stored as plaintext JSON; wallet import accepts a private key through an
  unauthenticated local API and passes it to a subprocess.
- The HTTP API has no session, CSRF protection, authorization, rate limiting, or explicit
  loopback bind in the call site.
- Several API bodies are cast to TypeScript interfaces without runtime validation.
- Error messages may expose internal subprocess or provider details.
- Source payload provenance, hashes, and immutable audit records are absent.
- AgentCash uses `npx` at runtime and can incur charges without an approval ledger.
- Static and API security headers are not configured.
- The current test suite does not cover prompt injection, tool-policy enforcement, API
  input validation, WebSocket payloads, storage recovery, or external-action approvals.

## Error handling and observability

- HTTP helpers return JSON errors, but error shapes and status mapping are inconsistent.
- Moltlaunch/AgentCash wrappers normalize some errors but do not attach structured codes,
  retryability, correlation IDs, or redacted diagnostic context.
- Heartbeat events are bounded in memory and important events are appended to daily Markdown.
- There are no structured logs, metrics, traces, durable job attempts, dead-letter queue,
  or health/readiness endpoints suitable for orchestration.
- Several JSON loaders return an empty collection on parse failure, which avoids crashes but
  can hide corruption and make data loss appear legitimate.

## Test infrastructure

- Seven tests cover basic LLM-loop termination, tool dispatch, usage accumulation, max turns,
  and quote/decline/submit flows.
- The tool registry is mocked, so current tests do not verify real marketplace tool policies
  or source integration contracts.
- Tests are excluded from the TypeScript compiler configuration.
- There are no API, persistence, adapter contract, security, UI, migration, Docker, or
  recovery tests.
- Future external integrations must use fixtures, fakes, and `FakeSourceAdapter`; baseline
  and CI must never send real messages, proposals, payments, or deliverables.

## Component migration map

| Component | Decision | Migration path |
| --- | --- | --- |
| LLM provider adapters | Preserve | Add time/cost metadata and validated structured outputs |
| Multi-turn LLM loop | Extend | Accept a source-neutral work context and policy-aware tools |
| MiniSearch memory | Preserve initially | Index PostgreSQL-backed learning records later |
| Feedback/study flow | Extend | Learn from normalized outcomes and real cost/profit data |
| React shell and visual language | Preserve | Add opportunities, approvals, sources, work, audit, analytics |
| Operator chat | Preserve behind interface | Apply authorization, redaction, budgets, and tool policy |
| Configuration hot reload | Preserve | Split public config from encrypted secret references |
| AgentCash | Keep optional/legacy | Route through cost, approval, allowlist, and audit boundaries |
| Moltlaunch CLI module | Move behind interface | Implement `MoltlaunchAdapter` without removing compatibility |
| Marketplace tools | Replace gradually | Introduce source capability tools and approval-mediated actions |
| Heartbeat | Split by responsibility | Scheduler, ingestion jobs, opportunity pipeline, work orchestrator |
| JSON persistence | Replace with migration path | Import existing data into PostgreSQL; retain read-only fallback |
| Combined HTTP server/router | Decompose | Route modules and services while remaining one process |

## Proposed module structure

```text
src/
  sources/          contracts, registry, adapters, cursors, health
  opportunities/    raw payloads, normalization, lifecycle, repositories
  scoring/          prefilter, detailed analysis, skill matching, ranking
  proposals/        pricing, proposal drafts, personalization
  approvals/        policies, approval requests, decision enforcement
  orchestration/    work-item state machine and resumable coordination
  execution/        isolated workspaces, allowlisted tools, artifacts
  qa/               check plans, check runs, reports, gates
  delivery/         packages, delivery approval, source submission
  costs/            estimates, reservations, token/API actuals, budgets
  learning/         outcomes, feedback, profile updates, memory indexing
  database/         pool, transactions, migrations, repositories
  scheduler/        durable jobs, leases, retries, dead-letter handling
  security/         secrets, untrusted content, SSRF, policy, redaction
  notifications/    operator notifications without implicit external send
  audit/            immutable structured action and decision events
  api/              route modules, validation, error mapping
  ui/               existing React application and new workflow pages
  moltlaunch/        legacy compatibility during migration
  loop/ memory/ llm/ tools/  reusable baseline components
```

This remains a modular monolith: one deployable application and one database, with explicit
module boundaries rather than independent network services.

## Preliminary PostgreSQL schema

The initial schema should use UUID primary keys, `timestamptz`, JSONB only for source-specific
or versioned payloads, explicit foreign keys, and append-only audit/cost events.

| Table | Purpose and important constraints |
| --- | --- |
| `sources` | Adapter type, enabled state, capability snapshot, config reference, health |
| `source_cursors` | One cursor per source/stream with optimistic version |
| `raw_payloads` | Immutable payload bytes/JSON, hash, parser version, provenance |
| `opportunities` | Normalized source-neutral opportunity and lifecycle status |
| `opportunity_sources` | External identity/URL mapping; unique `(source_id, external_id)` |
| `duplicate_groups` | Canonical opportunity and merge rationale |
| `opportunity_analyses` | Versioned prefilter/LLM outputs, prompt risk, confidence, usage |
| `opportunity_scores` | Explainable score components, weights, model/rules version |
| `agent_skill_profiles` | Skill evidence, proficiency, confidence, recency |
| `proposal_drafts` | Versioned proposal, price, assumptions, source action eligibility |
| `approval_requests` | Action, target, risk, payload digest, expiry, decision and actor |
| `work_items` | Durable work state machine linked to winning opportunity |
| `work_attempts` | Workspace, executor, limits, status, timestamps, failure code |
| `artifacts` | Content-addressed artifact metadata, type, size, provenance |
| `qa_runs` | Check plan, results, report artifact, pass/fail decision |
| `deliveries` | Package, approval, source submission id, status, receipt |
| `cost_events` | Estimated/reserved/actual token, API, compute, and platform costs |
| `payments` | Expected and observed payment state; no private payment credentials |
| `feedback_events` | Ratings, comments, outcome facts, source provenance |
| `learning_entries` | Versioned lessons and evidence linked to outcomes |
| `jobs` | Durable schedule, lease, retry/backoff, idempotency key, dead-letter state |
| `audit_events` | Append-only actor/action/target/result hashes and redacted context |

External action tables must use unique idempotency keys. Approval decisions must bind to a
payload digest so an approved draft cannot be replaced before submission. Destructive
migrations require an explicit expand/migrate/contract plan and rollback notes.

## Breaking-change and migration risks

1. Replacing `Task` directly would break prompts, tools, heartbeat, API, tests, and UI.
   Introduce `Opportunity` beside it and adapt Moltlaunch first.
2. PostgreSQL as an immediate hard dependency would break the current no-database startup.
   Add configuration validation, Compose, health checks, and a documented JSON import path.
3. Safe automation defaults conflict with current `autoQuote: true` and `autoWork: true`.
   Existing installs need an explicit migration to Observe/Draft rather than silent behavior.
4. Approval-mediated tools change LLM-loop behavior and require compatibility tests for
   accepted/revision Moltlaunch work.
5. Normalized identifiers must not be confused with external Moltlaunch task IDs.
6. Durable scheduling introduces concurrency and lease semantics absent from the current
   single-process in-memory sets.
7. Encrypting secrets requires a recoverable key strategy on Windows and containers.
8. Dependency remediation may require major Vite/Vitest upgrades and should not be combined
   with domain architecture changes.
9. Dashboard/API decomposition can change endpoint payloads; versioned DTOs or compatibility
   routes are required.
10. Source text and stored memory may already contain prompt-injection content; migration
    must preserve provenance and mark it untrusted instead of treating it as instructions.

## Phase 1 recommended scope

Phase 1 should be a contract-first, behavior-neutral slice:

1. Define source capabilities, adapter contract, raw opportunity, normalized opportunity,
   source cursor/result, and validation/health result types.
2. Define conservative automation modes and an opportunity lifecycle state machine.
3. Add `FakeSourceAdapter` plus contract tests written before implementation behavior.
4. Add a Moltlaunch adapter mapping layer without switching heartbeat execution yet.
5. Add prompt-content trust classification and policy interfaces, with all external actions
   denied unless capabilities and policy both permit them.

PostgreSQL, real new source connections, dashboard changes, and external side effects are
outside this first slice. This keeps the existing application buildable and makes later
adapters converge on one tested boundary.

## Phase 0 conclusion

The baseline is internally consistent and builds successfully, so architectural work can
continue. There are no source-code blockers. The environmental blocker is that the requested
workspace path currently denies shell/Git write access; the audit was therefore performed
in a temporary clone of the exact fork revision. This does not affect findings, but the
checkout must be moved or re-cloned into `C:\Users\Brux\Documents\AutoFreelance` after that
folder is made writable to the Codex shell.
