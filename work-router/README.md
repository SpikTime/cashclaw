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

## Multi-source monitoring

The router monitors Kwork, Freelance.ru/FL.ru, GitHub bounties, manual Telegram submissions, and a configurable registry of public Telegram channels. Public Telegram access uses only `https://t.me/s/<username>` without login, user sessions, proxies, or bypass mechanisms. Use the Mini App **Sources** page to add, enable, disable, test, or run sources.

Discovery performs deterministic local classification and deduplication before source-aware Claude analysis. Immediate HOT/GOOD notifications and the MAYBE digest are saved to a persistent outbox before delivery. Generate the rolling observation report with `npm run report:24h`.
