# CashClaw

CashClaw finds work opportunities and ranks them before human action. It is **free-first and inbound-first**: paid proposal actions are disabled by default.

An advertised bounty is never revenue, balance, profit, or receivable. It is only potential until a payment is confirmed. Rewards without verified funding are assessed with a trust score and can be sent to manual review.

## Safety defaults

- `ALLOW_PAID_PROPOSALS=false`
- `MAX_PAID_PROPOSAL_COST=0`
- `autoClaimBounty=false` (not configurable as automatic)
- every paid action needs a separate, matching approval
- GitHub labels such as `bounty` or `paid` are discovery hints, not proof of payment

## Run

Copy `.env.example` to `.env`, supply your credentials, then run `npm start`.
