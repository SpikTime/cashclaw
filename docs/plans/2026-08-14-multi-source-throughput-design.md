# CashClaw Multi-Source Throughput Design

**Date:** 2026-08-14  
**Status:** Approved  
**Scope:** `work-router/`

## Goal

Expand the existing work router with reliable free sources, especially public Telegram channels, while increasing useful analysis throughput without turning the system into a spam bot. Existing Kwork, Freelance.ru/FL.ru, GitHub, and bounty behavior must remain operational.

## Constraints

- Use a modular pipeline and local persistent storage; no paid infrastructure is required.
- Never send proposals or contact customers automatically.
- Never use a personal Telegram account, userbot session, phone credentials, 2FA secrets, stolen cookies, anti-detect tooling, or proxies to bypass restrictions.
- Telegram ingestion may use Bot API updates where the bot is legitimately present and public `https://t.me/s/<username>` pages without authentication. An unavailable source remains `manual` or `disabled` with an exact reason.
- Paid proposals remain disabled.
- Source priorities are not changed automatically after observation.

## Architecture

The router is split into small modules with explicit contracts:

1. **Source registry** stores source identity, type, ingestion mode, priority, enabled state, health, and quality statistics.
2. **Source adapters** return normalized raw items. Each adapter runs in an isolated failure boundary.
3. **Normalization and extraction** produce canonical text, URLs, contacts, budget, currency, deadline, technology stack, and freshness fields.
4. **Deterministic filtering** removes obvious spam, prohibited tasks, self-promotion, and irrelevant content without LLM use.
5. **Local classification** classifies the message and calculates cheap skill, monetary, safety, and freshness signals.
6. **Deduplication** merges reposts into a single opportunity and records every source where it appeared.
7. **Source-aware scheduler** assigns deep-analysis slots fairly across active sources.
8. **Deep analysis** uses Claude only for the best remaining candidates within configured quotas.
9. **Notification policy** assigns HOT, GOOD, MAYBE, suppressed, or manual-review outcomes.
10. **Persistent outbox** saves notifications before attempting delivery and retries transient Telegram failures idempotently.
11. **Cycle analytics** persist source and pipeline counters for the Mini App and the 24-hour report.

## Persistent State

The existing local JSON store is retained and extended with versioned defaults and atomic writes. It contains:

- normalized opportunities and their processing status;
- seen fingerprints and cross-source duplicate groups;
- source registry and per-source health/quality statistics;
- notification outbox with deterministic idempotency keys;
- cycle summaries and LLM daily counters;
- MAYBE digest entries;
- Telegram update offset.

Writes use a temporary file followed by an atomic replacement so interruption cannot leave partially written JSON. State migrations add missing fields without discarding existing jobs.

## Telegram Ingestion

The initial registry contains the requested high- and second-priority channel usernames. For each channel the system validates the username and attempts public read-only access through `t.me/s`. It records one of:

- `public`: public messages can be read without login;
- `bot_api`: posts arrive through legitimate Bot API updates;
- `manual`: automatic access is unavailable or not reliable;
- `disabled`: explicitly disabled by the operator.

Public adapters parse stable post containers, message identifiers, publication timestamps, text, links, and source message URLs. HTTP 401/403/404/429, login walls, unexpected markup, and timeouts are reported as source health errors. The adapter does not rotate identities or bypass restrictions.

## Classification and Safety

Messages are classified as:

`ONE_OFF_PROJECT`, `SHORT_PROJECT`, `BOUNTY`, `PART_TIME_CONTRACT`, `FULL_TIME_JOB`, `PARTNERSHIP`, `COFOUNDER`, `SELF_PROMOTION`, `SPAM`, or `UNKNOWN`.

Local rules prioritize one-off projects, short projects, and bounties. Part-time contracts receive reduced priority; full-time vacancies do not dominate the feed. Unpaid or equity-only co-founder proposals receive a low monetary score. Explicitly unsafe or prohibited categories are rejected locally.

Budget extraction is deterministic and supports rubles, dollars, USDT, euros, ranges, upper/lower bounds, and negotiable budgets. The LLM may interpret supplied text but must not invent a missing amount.

## Deduplication

Exact matching uses normalized text hashes and canonical external URLs. Near-duplicate matching uses contact username, normalized budget, publication window, token similarity, and text shingles. Matching posts merge into one opportunity with a source list and `Found in N sources`; they do not consume multiple analysis or notification slots.

## Throughput and Scheduling

The cycle becomes a two-stage pipeline:

`raw items -> deterministic filter -> local cheap classification -> source-aware selection -> deep Claude analysis`

Initial configurable limits:

- `SOURCE_MAX_CHEAP_LLM_PER_CYCLE=40`
- `SOURCE_MAX_DEEP_LLM_PER_CYCLE=12`

The cheap stage is local by default and therefore does not consume Claude quota. Each active source with candidates receives at least one deep slot when capacity permits. Remaining slots are ranked by candidate score, source quality, and freshness. Daily quota remains a final safety cap.

## Notifications and Outbox

Configurable bands are:

- HOT: score 70 or greater, immediate alert;
- GOOD: score 55–69, immediate normal alert;
- MAYBE: score 45–54, one combined digest;
- below 45: no notification by default.

A very fresh, free-to-contact candidate with skill match at least 80 and preliminary score at least 75 may create an explicit preliminary fast alert before deep analysis completes.

Low-trust bounties are never presented as ordinary GOOD opportunities. High advertised reward or strong feasibility can instead create a manual-review warning.

Every outgoing message is saved first. Delivery state moves through `pending`, `sending`, `retry`, `sent`, or `dead`. Transient failures use bounded exponential backoff with jitter. The outbox key combines opportunity, notification type, and destination, preventing duplicate delivery after restarts.

## Failure Isolation

Source fetch, normalization, LLM analysis, and Telegram delivery have independent error boundaries and retry policies. A Telegram failure cannot stop Kwork, Freelance.ru/FL.ru, GitHub, persistence, or later source processing. A single source failure appears in the cycle summary but does not mark the entire cycle failed.

## Mini App

The existing Mini App gains a Sources view containing username, display name, enabled state, priority, ingestion mode, last check/success/error, item counts, opportunity counts, and quality score. It supports Add Telegram Source, Enable, Disable, Test, and Run now. Server endpoints validate Telegram Mini App identity and source usernames; they never expose tokens or private configuration.

The jobs view shows classification, age, budget confidence, all source links, notification band, and current outbox/delivery state. A cycle summary displays scanned, new, duplicate, locally rejected, cheap/deep analyzed, HOT/GOOD/MAYBE, delivery, and error counters.

## Source Quality and Observation

Per-source counters include messages seen, opportunities detected, relevant opportunities, duplicates, spam rate, budget presence, operator approvals/rejections, proposals created, and jobs won. A conservative weighted score is displayed only after a minimum sample; sparse sources remain unrated.

After deployment the router records 24 hours of observation without contacting customers. It generates `docs/SOURCE_24H_REPORT.md` with source rankings, throughput, duplicates, budgets, notification bands, false positives, and operator interest. The report recommends priority changes but never applies them automatically.

## Delivery Sequence

Implementation proceeds in independently testable commits:

1. failure isolation and persistent outbox;
2. two-stage local/deep pipeline;
3. source-aware scheduling;
4. Telegram classification and extraction;
5. cross-source deduplication;
6. configurable source registry;
7. verified public Telegram adapters;
8. source quality and cycle analytics;
9. notification bands, fast alerts, and MAYBE digest;
10. Mini App controls and 24-hour report generation.

Each increment must retain passing tests and build checks. Final verification includes tests, typecheck, build, skill validation, security review, a live discovery cycle, Telegram delivery retry behavior, and confirmation that no paid proposal or automatic customer-contact path is enabled.

## Acceptance Criteria

- Existing Kwork, Freelance.ru/FL.ru, GitHub, and bounty tests remain green.
- One downstream failure cannot abort unrelated sources or lose qualified opportunities.
- At most the configured number of deep Claude analyses run per cycle, distributed across sources.
- Telegram sources are configurable without code changes and clearly report their actual ingestion mode.
- Cross-channel reposts become one opportunity with all source references.
- HOT and GOOD alerts are immediate; MAYBE items are digested; retries are idempotent.
- Cycle/source analytics and the 24-hour report contain the requested measurable counters.
- The system never logs secrets, bypasses Telegram access controls, purchases proposals, or contacts customers automatically.
