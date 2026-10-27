# Architecture

This is the short version. The full design, with the reasoning behind each choice, is in [BUILD_PLAN.md](BUILD_PLAN.md) sections 2–8.

## Flow

```
Sources (Jira · SQL view poller · webhook · CSV)
   │ raw payload → inbox table
   ▼
Ingest: dedupe (source + hash), schema fingerprint, map to canonical Ticket
   │ Procrastinate job (one per ticket, queueing lock on ticket id)
   ▼
LangGraph pipeline, thread_id = ticket id, Postgres checkpointer
   intake → validate → classify (optional LLM → Signal) → policy (rules) → assign (picker + SLA) → commit
                                                            │ uncertain
                                                            ▼
                                                  interrupt() → human review → Command(resume=…)
   ▼
commit: Decision + audit row + outbox row (idempotency key)
   ▼
Outbox worker → source write-back (only in `auto` mode, or after human acceptance)
```

## Hexagonal layers

| Layer | Package | May import |
| --- | --- | --- |
| Domain | `triaged.core` | stdlib, pydantic, yaml, re2. Nothing else from `triaged`. |
| Pipeline | `triaged.pipeline` | core, LangGraph, ports |
| Adapters | `triaged.adapters.*`, `triaged.mapping` | core, their own vendor SDKs |
| Entry points | `triaged.api`, `triaged.workers`, `triaged.cli` | everything above |

`lint-imports` (contracts in `pyproject.toml`) enforces the domain and LangGraph boundaries in CI.

## Invariants

1. Rules decide; models only read. LLM output never sets team or assignee.
2. Missing data evaluates to `unknown`, and `unknown` on a deciding rule sends the ticket to review.
3. Every external write goes through the outbox with a deterministic idempotency key.
4. `decision_id = hash(ticket_id, ruleset_version, prompt_version, input_hash)`.
5. New queues start in `shadow` mode; promotion is an audited action.
6. The audit table is append-only (Postgres trigger).

## Screens

No custom frontend. Each screen is served by an open-source platform reading the Triaged API, a read-only Postgres role, Prometheus metrics or OTel traces. See [mockups/](mockups/) and `deploy/`.

| Screen | Platform |
| --- | --- |
| Pipeline, SLA, Insights | Grafana |
| Ticket trace, classifier evals | Langfuse |
| Review queue, Rules, Admin | Appsmith (every action calls the API) |
| Sign-in and roles | Keycloak |
