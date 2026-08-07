# Checkout Revamp — Weekly Sync Notes

Date: 2026-07-24
Attendees: Priya Raman (EM), Dan Okafor (Backend), Maya Lindqvist (Platform), Tom Reyes (Design)

## Decisions

- **API timeout set to 15 seconds with two retries.** Agreed in the 2026-07-10 design
  review after the gateway team confirmed p99 latency of 4.2s. The previous 10-second
  client timeout was cutting off legitimate slow payments.
- Payment retry path moves to Sprint 34. Not a launch blocker.
- We ship behind a feature flag at 5% traffic before any wider rollout.
- Vendor contract renewal owned by Priya, not Finance. Escalation path is Ops.

## Open questions

- Do we need idempotency keys on the retry path, or does the gateway dedupe for us?
  Dan to confirm with the vendor by Sprint 34 planning.
- Nobody has owned the rollback plan if the flag has to go to 0% during business hours.

## Action items

- Dan — fix client timeout config from 10s to 15s — Sprint 33
- Maya — rerun load test with new timeout, post results — Wednesday
- Priya — chase vendor contract signature — end of month
- Tom — final error-state copy for declined payments — Sprint 33

## Risks raised

- Vendor contract for the payment gateway is unsigned with Q3 renewal approaching.
  If it lapses we lose the sandbox environment first, production 30 days later.
- Load test has never been run at the new timeout. Numbers in the spec are modelled,
  not measured.
- Single-maintainer risk on the reconciliation service — only Maya has deploy access.
