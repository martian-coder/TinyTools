# Triagent

> Open-source escalation triage. Reads tickets from any source, applies versioned business rules and an optional LLM classifier, routes each ticket to the right team and person within its SLA, and sends anything uncertain to a human, with a full audit trail.

**Status:** Phase 0 (scaffold). No triage logic yet. See [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) for the plan and phases.

> This folder is incubating inside TinyTools and will move to its own GitHub organisation (see section 16 of the build plan).

## Principles

- **Rules decide; models only read.** LLM output is a signal, never a routing decision.
- **Shadow first.** Every queue starts by deciding without writing.
- **Missing data means review.** Unknown values never pass a rule.
- **Synthetic data only.** All examples use the fictional company *Northwind Devices*.

## Quickstart (development)

Requires Python 3.13+, [uv](https://docs.astral.sh/uv/) and Docker.

```bash
uv sync
uv run pre-commit install
docker compose up -d db
uv run triagent --help
uv run pytest -q
```

## Layout

| Path | What |
| --- | --- |
| `backend/triagent/core/` | Pure domain: models, rules, picker, SLA, ports. No framework imports. |
| `backend/triagent/pipeline/` | LangGraph triage graph (the only place LangGraph is imported). |
| `backend/triagent/adapters/` | Sources, LLM providers, Postgres store, queue, notifiers. |
| `backend/triagent/api/` | FastAPI routers and SSE. |
| `frontend/` | Vue 3 dashboard (Phase 7). |
| `config/examples/northwind/` | Fictional example configuration. |
| `tests/` | Unit, integration, e2e, golden and cassette tests. |
| `docs/` | Architecture and build plan. |

## Licence

[Apache-2.0](LICENSE).
