# Bounty change report

## Delivered

- Added acquisition models and an explicit paid-proposal policy.
- Added bounty reward, trust, anomaly, feasibility and economics models.
- Added GitHub bounty enrichment and manual Opire import adapter.
- Added Mini App reward detail, money-state-safe analytics API, and tests.

## Data model

Persistent bounty fields are stored with jobs in this lightweight deployment; a production relational migration would split them into `bounty_rewards`, `bounty_contributors`, `bounty_activities`, `bounty_claims`, `bounty_payment_events` and `bounty_trust_evaluations`.

## API and UI

`GET /api/jobs` now includes bounty facts and `bountyAnalytics`. The interface shows advertised, expected and capped reward separately, funding, trust, payment probability, anomaly, feasibility and expected profit.

## Policy and limitations

Paid proposals and claims are blocked by default. The Opire documentation describes platform/bot flows but no documented public read API was used here; the adapter accepts operator-imported reward data only. GitHub labels and reward text remain untrusted discovery signals.

## Validation

The unit suite covers paid-action blocking, acquisition costs, fresh/old unpaid rewards, extreme anomalies, small bounty fast lane, Opire manual import and revenue accounting. No advertised amount is reported as paid revenue.
