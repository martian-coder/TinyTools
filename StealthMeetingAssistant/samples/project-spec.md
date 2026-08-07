# Project Spec — Checkout Revamp v2

Status: Approved
Owner: Priya Raman
Last updated: 2026-07-18

## Goal

Reduce checkout abandonment from 18% to under 12% by removing the forced account
creation step and making payment failures recoverable.

## Scope

In scope: guest checkout, payment retry, error-state copy, feature-flagged rollout.
Out of scope: subscription billing, multi-currency, wallet integrations.

## Timeouts and retries

The payment client MUST use a **15 second timeout** with **two retries** and
exponential backoff (1s, then 4s). This supersedes the 10-second value in v1 of
this spec.

Rationale: the gateway reports p99 latency of 4.2 seconds under normal load and up
to 11 seconds during end-of-month settlement windows. A 10-second timeout was
cancelling transactions that would otherwise have succeeded.

Retries MUST carry an idempotency key derived from the order id. Without it a retry
can double-charge during a settlement window.

## Rollout plan

1. Feature flag at 5% of traffic for one week.
2. Review abandonment and error rates against the control group.
3. Step to 25%, then 100%, with a 24-hour soak at each step.
4. Rollback is flag-to-zero; no schema changes are involved, so rollback is safe
   at any point.

## Non-functional requirements

- Checkout p95 end-to-end under 2.5 seconds.
- No PII in application logs. Card data never touches our servers.
- Reconciliation job must complete within the 04:00–06:00 UTC window.

## Known gaps

- Load testing at the 15-second timeout has not been performed. The numbers above
  are modelled from gateway telemetry, not measured end to end.
- The rollback runbook has no named owner.
