# CLAUDE.md: standing instructions for this repo

## Project
Triagent: open-source escalation triage. Read docs/ARCHITECTURE.md before large changes; the phased plan is docs/BUILD_PLAN.md.
While incubating inside the TinyTools repo, run every command from the `Triagent/` folder. CI lives in TinyTools' `.github/workflows/triagent-ci.yml` until the move.

## Golden rules
- Rules decide; models only read. Never let LLM output set team/assignee directly.
- core/ must not import fastapi, langgraph, sqlalchemy, pydantic_ai, procrastinate, or any vendor SDK (import-linter enforces this).
- LangGraph is imported only in pipeline/.
- All examples and fixtures use the fictional "Northwind Devices" and synthetic data only.
- Every write to an external system goes through the outbox with an idempotency key.
- Missing data → "unknown" → review. Never guess silently.

## Commands
- Setup: `uv sync && pre-commit install && docker compose up -d db`
- Test: `uv run pytest -q` (unit) · `uv run pytest -m integration` (needs Docker for testcontainers)
- Lint/type: `uv run ruff check . && uv run mypy backend/triagent/core && uv run lint-imports`
- Regenerate schemas: `uv run triagent schemas export`
- Screens: `docker compose --profile demo up` (Grafana, Langfuse, Appsmith, Keycloak with seeded Northwind data)
- Seed data: `uv run triagent seed --company northwind --tickets 500`

## Workflow
- Plan first for anything touching more than 3 files; list files and tests before editing.
- Write or update tests in the same change. Run the relevant tests before saying done.
- Small PR-sized steps. Conventional commits (feat:, fix:, docs:, test:, refactor:).
- Update docs/ when behaviour or config changes.

## Style
- Python: typed, async I/O, Pydantic v2 models at boundaries, no bare except, timezone-aware datetimes only.
- Screens: no custom frontend. Grafana dashboards, Appsmith apps and Langfuse config live in deploy/ as exported files; every action goes through the Triagent API, never straight to the database.
