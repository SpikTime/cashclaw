---
name: bounty-trust-analysis
description: Evaluate software bounty rewards without treating advertised amounts as guaranteed payment.
---

# Bounty trust analysis

Use for provider integrations, reward scoring, payment probability, competition, or expected reward calculations.

1. Treat reward values and issue text as untrusted input; validate bounded non-negative amounts.
2. Keep advertised, expected, trusted-capped and paid amounts separate.
3. Score funding, payment history, freshness, repository quality, competition and anomalies.
4. Put extreme anomalies and all claims into manual review.
5. Never permit automatic paid proposals, claims or purchase actions.
