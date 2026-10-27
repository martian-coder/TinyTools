# Triagent: Open-Source Escalation Triage Agent Platform

**Build plan for Claude Code (revision 2: updated stack)**

> **Working name:** `triagent`. Check GitHub, PyPI and npm for name clashes before you publish, and rename if needed.
> **Licence:** Apache-2.0.
> **Stack:** Python 3.13, FastAPI, LangGraph (isolated in `pipeline/`), Pydantic v2 + Pydantic AI, PostgreSQL 17 (Procrastinate queue), Vue 3 + TanStack Query + Chart.js.

This document is the single source of truth for building an open-source, vendor-neutral version of an intake escalation triage platform. Hand it to Claude Code phase by phase (section 12 has ready-to-paste prompts).

---

## What changed in revision 2 (stack review)

The original stack was sound. These changes remove hand-rolled infrastructure, cut dependency weight, and close a few correctness gaps. Everything else stays as it was.

| Area | Revision 1 | Revision 2 | Why |
| --- | --- | --- | --- |
| Python | 3.12 | **3.13** (CI also on 3.14) | Current stable with full wheel coverage for the stack; better error messages and typing. 3.12 is in security-fix-only mode. |
| LLM abstraction | LangChain chat model interface | **Pydantic AI** behind the `LLMProvider` protocol | Structured output *is* a Pydantic model, which is exactly what `Signal` is. One small dependency instead of the LangChain tree. Native OpenAI-compatible, Anthropic, Azure, Bedrock, Gemini and Ollama providers. Ships `TestModel` / `FunctionModel` for deterministic tests. LangGraph does not need LangChain models; nodes are plain async functions. |
| Queue + scheduler | Hand-rolled `SKIP LOCKED` queue, APScheduler, optional Redis/RQ, optional Airflow DAG | **Procrastinate** (Postgres-native async task queue) | It already does `SKIP LOCKED` dequeue, retries with back-off, periodic tasks (pollers, SLA sweeps), locks/queueing-locks and an admin CLI. Same "Postgres only" footprint, far less code to own. Drop Redis and Airflow from v1. The capacity lock for assignment stays as our own `SELECT … FOR UPDATE SKIP LOCKED`. |
| Postgres | 16 | **17** (CI also on 18) | Faster vacuum and JSON functions (`JSON_TABLE`); 16 works but there is no reason to start a new project on it. |
| DB driver | unspecified (async SQLAlchemy usually means asyncpg) | **psycopg 3** (async) for everything | `langgraph-checkpoint-postgres` and Procrastinate both use psycopg 3. One driver, one pool configuration, one set of TLS settings. |
| Regex operator | `re` "with a timeout" | **google-re2** | Python's `re` has no timeout, so ReDoS protection by timeout needs threads or processes. RE2 is linear-time by construction; reject patterns RE2 cannot compile at ruleset validation time. |
| Rules JSON Schema | Separate hand-written schema | **Generated from Pydantic models** (`model_json_schema()`) | One source of truth. The same schema drives YAML validation, the UI editor's autocomplete and the docs. |
| Live events (SSE) | SSE from the API process | **sse-starlette + Postgres `LISTEN/NOTIFY`** | Workers run in other processes; `NOTIFY` fans events out to every API replica without adding Redis. |
| Webhook ingest | Process in request | **Write raw payload to an `inbox` table, return 202** | Never lose a webhook because a downstream step is slow or down. The ingest task picks it up from the queue. |
| Settings / CLI / HTTP | unspecified | **pydantic-settings, Typer, httpx** | Typed config from env; typed CLI; one async HTTP client used by every connector (write our own small Jira client rather than a sync SDK). |
| Auth | "generic OIDC" | **Authlib** (OIDC/JWT validation) | Maintained, provider-neutral, works with Keycloak, Entra ID, Okta, Auth0, Dex. Ship Keycloak in the compose demo. |
| Frontend server state | Pinia for everything | **TanStack Query (Vue)** for server state, Pinia for UI state only | Caching, refetch, optimistic updates for review actions, SSE-driven invalidation, with no hand-written loading/error flags. |
| Frontend API types | unspecified | **openapi-typescript + openapi-fetch** generated from FastAPI's OpenAPI | Backend and frontend types can't drift; CI fails if the generated client is stale. |
| Rules editor | "YAML with validation" | **CodeMirror 6** + `codemirror-json-schema` (YAML mode) | Lighter than Monaco; schema-driven autocomplete and inline errors from the same generated JSON Schema. |
| Frontend unit tests | Playwright only | **Vitest** + Playwright | Fast component and store tests; Playwright stays for e2e. |
| Node | unspecified | **Node 24 LTS** | Current active LTS. |
| Integration tests | docker compose in CI | **testcontainers-python** (Postgres) | Each test session gets a clean, throwaway database; works the same locally and in CI. |
| HTTP cassettes | "VCR-style" | **pytest-recording** (vcrpy) + **respx** for hand-written mocks | Concrete choices; both understand httpx. |
| Logs | structured JSON | **structlog** (JSON renderer) with OTel trace ids injected | |
| LLM observability | OTel only | OTel with **GenAI semantic conventions**; optional export to self-hosted Langfuse or Arize Phoenix | Prompt, token and latency tracing without a vendor lock-in. Pydantic AI emits OTel spans natively. |
| Container | multi-stage Dockerfile | Multi-stage with `uv` + **distroless/`python:3.13-slim`** runtime, non-root user | Smaller attack surface. |
| Supply chain | "signed images" | **cosign** keyless signing, **syft** SBOM, GitHub artifact attestations | Concrete, free, standard. |
| Docs site | MkDocs | **MkDocs Material** (or **Zensical**, its successor from the same team, if stable when you start) | Check the status before you start: Material for MkDocs is in maintenance mode. |

**Things deliberately kept:** FastAPI, Pydantic v2, SQLAlchemy 2.0 + Alembic, LangGraph (for checkpoints and `interrupt()`), Vue 3 + Vite + TS + Pinia, Chart.js 4, uv, ruff, mypy, hypothesis, Playwright, ESLint + Prettier, OpenTelemetry + Prometheus.

**On LangGraph:** the pipeline is linear, so LangGraph earns its place only through the Postgres checkpointer and `interrupt()`/`Command(resume=…)`. Keep every LangGraph import inside `backend/triagent/pipeline/`. Nodes call pure functions from `core/`. If LangGraph ever becomes a burden, the graph can be replaced by a small state machine over the `decisions` table without touching `core/`.

---

## 0. Read this first: clean-room rules

This project must be a **clean-room build**. It must not contain anything from an employer's codebase, data or configuration.

- No employer code, ticket data, field names, project keys, people names, SME lists or rule documents. That includes anything like CIPS, CQM or Fusion source ids.
- All examples use a **fictional company** ("Northwind Devices", a laptop and server maker) and **synthetic data** generated by a script in the repo.
- Write everything from scratch, on personal time and personal hardware, after checking your employment agreement. Get written approval from your employer's open-source or legal office if your contract has an IP-assignment clause. This guide is not legal advice.
- Add a `CONTRIBUTING.md` with a DCO sign-off (`git commit -s`) so every contribution carries its own provenance.

---

## 1. What it does (product definition)

**One sentence:** Triagent reads escalation tickets from any source, applies versioned business rules and an optional LLM classifier, routes each ticket to the right team and person within its SLA, and sends anything uncertain to a human, with a full audit trail.

### Core capabilities (v1.0)

| Capability | Description |
| --- | --- |
| **Connectors** | Jira Cloud/Data Center, SQL Server or Postgres table/view polling, generic webhook, CSV import. Pluggable interface. |
| **Normalisation** | Every source maps to one canonical `Ticket` model through a **field-mapping config**, not code. |
| **Rules engine** | Deterministic, versioned, layered (global, then region, then queue). Closed DSL in YAML. Tri-state result: `pass` / `fail` / `unknown`. |
| **LLM triage (optional)** | Provider-agnostic via Pydantic AI: OpenAI-compatible endpoints, Anthropic, Azure OpenAI, local vLLM or Ollama. Structured output only, and it **never decides alone**. |
| **People picker** | Strategies: round-robin, least-loaded, skill-match, follow-the-sun, sticky-owner. Capacity-aware. |
| **SLA engine** | Per region, severity and queue. Business-hours calendars and breach prediction. |
| **Human in the loop** | Review queue with accept, override and redirect actions. Overrides feed rule-tuning reports. |
| **Write-back** | Idempotent updates to the source (assign, label, comment, transition) via an outbox pattern. |
| **Dashboard** | Vue 3 and Chart.js: pipeline view, review queue, rules editor, SLA and insights, admin. Three themes. |
| **Operating modes** | `shadow` (decide but don't write), `assist` (suggest only), `auto` (write high-confidence decisions). Per queue. |
| **Audit** | Every decision stores its inputs, rule version, rule trace, model output, confidence and actor. Replayable. |

### Non-goals for v1

- Ticket resolution or customer replies
- Model fine-tuning
- Multi-tenant SaaS hosting. Ship it **self-hosted first**.

---

## 2. Architecture

```
          ┌──────────── Sources ─────────────┐
          │ Jira · SQL poller · Webhook · CSV│
          └───────────────┬──────────────────┘
                          │  raw payload → inbox table (202 for webhooks)
                    ┌─────▼──────┐
                    │  Ingest    │  dedupe (source_id + hash), schema fingerprint
                    └─────┬──────┘
                          │  canonical Ticket (Pydantic) → Procrastinate job
     ┌────────────────────▼─────────────────────────────┐
     │            LangGraph triage pipeline             │
     │                                                  │
     │  01 Intake → 02 Validate → 03 Classify (LLM opt) │
     │        → 04 Policy (rules) → 05 Assign (picker)  │
     │        → 06 Commit (outbox + audit)              │
     │                    │                             │
     │          uncertain │ interrupt()                 │
     │                    ▼                             │
     │             Human review queue                   │
     └────────────────────┬─────────────────────────────┘
                          │
          ┌───────────────▼──────────────────┐
          │ Outbox worker → source write-back│  idempotent, retried
          └──────────────────────────────────┘

   Postgres: inbox · tickets · decisions · audit · rulesets · outbox
             · checkpoints · procrastinate_jobs
   Events:   Postgres LISTEN/NOTIFY → API → SSE
   API: FastAPI (REST + SSE)      UI: Vue 3 + TanStack Query + Chart.js
```

### Key design decisions (keep these, they are the product)

1. **Rules decide; models only read.** The LLM returns structured *signals* (product line, intent, sentiment, a summary, plus confidence). The rules engine makes the routing decision. That makes every decision explainable and auditable.
2. **Hexagonal architecture.** The domain core has no imports from FastAPI, LangGraph, SQLAlchemy, Pydantic AI, Procrastinate or any vendor SDK. Connectors, LLM providers and stores are adapters behind `Protocol` interfaces. Enforce it in CI with `import-linter`.
3. **Configuration is data.** Field mappings, rulesets, SLA calendars and picker strategies are versioned YAML or database rows, editable in the UI, and never hard-coded.
4. **Idempotent everything.** Each decision has a deterministic `decision_id = hash(ticket_id, ruleset_version, prompt_version, input_hash)`. Write-backs go through an outbox table with an idempotency key.
5. **Shadow first.** Every new queue starts in `shadow` mode. Promotion to `auto` is a deliberate, audited action.
6. **Schema drift is expected.** Source fields are fingerprinted on every poll. Unknown or missing mapped fields raise an alert and push affected tickets into review; they never fail silently.

### Concurrency model

- Within a ticket, the six nodes run **in sequence**, because each depends on the previous one.
- Across tickets, Procrastinate workers process them **in parallel**. Each ticket gets its own LangGraph thread (`thread_id = ticket_id`) with a Postgres checkpointer. Use a Procrastinate `queueing_lock` per ticket id so one ticket is never processed twice concurrently.
- Assignment uses a **row-level lock** (`SELECT … FOR UPDATE SKIP LOCKED`) on the assignee capacity table, so two tickets never take the last free slot.
- Batch sources (SQL polling, as Procrastinate periodic tasks) fan out into the same queue as streaming sources.

---

## 3. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Language | Python 3.13 (CI: 3.13, 3.14) | LangGraph ecosystem, typing |
| Package and env | `uv` (workspace) | Fast, reproducible lockfile |
| API | FastAPI with Uvicorn | Async, OpenAPI out of the box |
| Models | Pydantic v2, pydantic-settings | Validation, JSON Schema for LLM output and the rules DSL |
| Orchestration | LangGraph with `langgraph-checkpoint-postgres`, confined to `pipeline/` | Checkpoints, `interrupt()` for human review |
| LLM | Pydantic AI behind a thin `LLMProvider` protocol | Typed structured output, many providers, deterministic test models, native OTel |
| Database | PostgreSQL 17, SQLAlchemy 2.0 (async, psycopg 3), Alembic | Durable state, outbox, locks; one driver shared with the checkpointer and queue |
| Queue and scheduler | Procrastinate | Postgres-native jobs, retries, periodic tasks, locks; no Redis |
| Live events | Postgres `LISTEN/NOTIFY` + sse-starlette | Multi-process fan-out without a broker |
| Regex | google-re2 | Linear-time matching; no ReDoS |
| HTTP client | httpx | Async, one client for every connector |
| CLI | Typer | Typed commands |
| Auth | Authlib (OIDC, JWT) | Provider-neutral |
| UI | Vue 3, Vite, TypeScript, Pinia (UI state), TanStack Query (server state), Chart.js 4, CodeMirror 6 | Matches enterprise constraints |
| API client | openapi-typescript + openapi-fetch | Generated types from FastAPI |
| Tests | pytest, pytest-asyncio, hypothesis, testcontainers, pytest-recording, respx, Vitest, Playwright | Deterministic, replayable |
| Quality | ruff, mypy (strict on `core/`), import-linter, pre-commit, ESLint, Prettier | |
| Packaging | Docker multi-stage (uv build, slim/distroless runtime, non-root), `docker compose` for local, Helm chart in v1.1 | Self-hosted first |
| Observability | OpenTelemetry traces (incl. GenAI conventions), Prometheus metrics, structlog JSON logs | |
| Supply chain | Dependabot, CodeQL, pip-audit, npm audit, syft SBOM, cosign signing | |

---

## 4. Repository layout

```
triagent/
├── CLAUDE.md                  # standing instructions for Claude Code (section 11)
├── README.md
├── LICENSE                    # Apache-2.0
├── NOTICE
├── CONTRIBUTING.md            # DCO, dev setup, PR rules
├── SECURITY.md                # private disclosure process
├── CODE_OF_CONDUCT.md
├── docker-compose.yml         # db, keycloak (demo profile), api, worker, ui
├── pyproject.toml / uv.lock
├── backend/
│   └── triagent/
│       ├── core/              # pure domain: no framework imports (import-linter enforced)
│       │   ├── models.py      # Ticket, Signal, Decision, RuleResult, Assignment
│       │   ├── rules/         # DSL models, evaluator, layering, tracer
│       │   ├── picker/        # assignment strategies
│       │   ├── sla/           # calendars, deadlines, breach prediction
│       │   └── ports.py       # Protocols: SourceConnector, LLMProvider, Store, Notifier, Clock
│       ├── pipeline/          # LangGraph graph, nodes, state, interrupts (only place LangGraph is imported)
│       ├── adapters/
│       │   ├── sources/       # jira/, sql/, webhook/, csv/
│       │   ├── llm/           # pydantic_ai_provider.py, fake.py
│       │   ├── store/         # postgres repositories, outbox, inbox
│       │   ├── queue/         # procrastinate app and tasks
│       │   └── notify/        # email, Slack, Teams webhooks
│       ├── mapping/           # field-mapping config loader, schema fingerprinting
│       ├── api/               # FastAPI routers, auth, SSE stream
│       ├── workers/           # ingest, pipeline, outbox tasks; periodic pollers and SLA sweeps
│       ├── settings.py        # pydantic-settings
│       └── cli.py             # Typer: triagent run | replay | dry-run | rules test | seed
├── frontend/
│   └── src/
│       ├── api/               # generated OpenAPI types + openapi-fetch client
│       ├── queries/           # TanStack Query composables
│       ├── views/             # Pipeline, Review, Rules, SLA, Insights, Admin
│       ├── components/charts/ # Chart.js wrappers and custom plugins (gauge, rings, heatmap)
│       ├── themes/            # atlas.css, nebula.css, slate.css (design tokens)
│       └── stores/            # Pinia (UI state only: theme, filters, layout)
├── config/examples/northwind/ # fictional company: mappings, rulesets, SLAs, teams
├── schemas/                   # generated JSON Schemas (ruleset, mapping); checked in, CI verifies fresh
├── scripts/seed_synthetic.py  # generates realistic fake tickets
├── tests/
│   ├── unit/ · integration/ · e2e/
│   ├── golden/                # input ticket → expected decision and trace (YAML)
│   └── cassettes/             # recorded API responses (synthetic only)
├── docs/                      # MkDocs Material / Zensical: concepts, rules DSL, connectors, deployment
└── .github/workflows/         # ci.yml, release.yml, codeql.yml
```

---

## 5. Domain model (Pydantic v2)

```python
class Ticket(BaseModel):
    id: str                      # "<source>:<native_id>"
    source: str
    native_id: str
    title: str
    body: str
    region: str | None
    product_line: str | None
    severity: Literal["sev1","sev2","sev3","sev4"] | None
    high_priority: bool = False
    reporter: str | None
    created_at: AwareDatetime    # timezone-aware only; SLA maths depends on it
    custom: dict[str, Any] = {}  # mapped extra fields
    raw_hash: str                # for dedupe and replay

class Signal(BaseModel):         # LLM output; never routes on its own
    product_line: str | None
    intent: Literal["defect","question","rma","wrong_queue","other"]
    summary: str = Field(max_length=500)
    confidence: float = Field(ge=0, le=1)
    model: str
    prompt_version: str

class RuleResult(BaseModel):
    rule_id: str
    outcome: Literal["pass","fail","unknown"]
    reason: str

class Decision(BaseModel):
    decision_id: str
    ticket_id: str
    action: Literal["assign","redirect","review","reject"]
    team: str | None
    assignee: str | None
    sla_due: AwareDatetime | None
    ruleset_version: str
    trace: list[RuleResult]
    signal: Signal | None
    confidence: float
    mode: Literal["shadow","assist","auto"]
    decided_by: Literal["system","human"]
```

`Signal` is passed directly to Pydantic AI as the agent's `output_type`. The adapter fills `model` and `prompt_version` itself; the model is never asked to report them.

---

## 6. Rules DSL (closed, safe, testable)

Rulesets are YAML, versioned with semver and immutable once published. There is **no `eval`** and no arbitrary code. Operators are a fixed, documented set. The DSL is defined as Pydantic models; YAML is loaded with `yaml.safe_load` and validated against them, and `schemas/ruleset.schema.json` is generated from the same models.

```yaml
ruleset: northwind-global
version: 1.4.0
extends: []
rules:
  - id: sev1-always-review
    when: { field: severity, op: eq, value: sev1 }
    then: { action: review, reason: "Sev 1 needs a human" }
  - id: storage-to-storage-team
    when:
      all:
        - { field: product_line, op: in, value: [storage, san, nas] }
        - { field: region, op: in, value: [EMEA, APJ, AMER] }
    then: { action: assign, team: "storage-{region}" }
  - id: low-confidence-review
    when: { signal: confidence, op: lt, value: 0.75 }
    then: { action: review, reason: "Classifier unsure" }
```

**Evaluator rules:**

- **Operators:** `eq`, `ne`, `in`, `not_in`, `contains`, `regex` (RE2, compiled at validation time; patterns RE2 rejects fail validation), `lt`, `lte`, `gt`, `gte`, `exists`, `missing`, `all`, `any`, `not`.
- **Missing fields** evaluate to `unknown`, never to `false`. An `unknown` on a deciding rule sends the ticket to `review`.
- **Three-valued logic:** `all`/`any`/`not` follow Kleene logic (`all` with any `fail` is `fail`; otherwise any `unknown` is `unknown`). Property-test this.
- **Templates:** `{region}`-style placeholders in `then` only substitute known fields; an unresolved placeholder yields `unknown` → `review`.
- **Layering:** global, then region, then queue. The first terminal match wins inside a layer, and a more specific layer overrides a broader one. The full trace is always recorded.
- **Testing:** `triagent rules test <ruleset>` runs the golden tests in `tests/golden/`. CI blocks publishing a ruleset whose golden tests fail.

**Turning rule documents into rules:** a separate, optional `triagent rules draft <doc.pdf>` command uses the LLM to *propose* YAML rules with citations to the source paragraph. A human reviews and commits them, and drafts never go live automatically.

---

## 7. LangGraph pipeline

```python
class TriageState(TypedDict):
    ticket: Ticket
    signal: Signal | None
    rule_results: list[RuleResult]
    decision: Decision | None
    errors: list[str]

graph = StateGraph(TriageState)
graph.add_node("intake", intake)        # normalise, enrich, dedupe
graph.add_node("validate", validate)    # reference checks, required fields
graph.add_node("classify", classify)    # optional LLM → Signal (skipped by config)
graph.add_node("policy", policy)        # rules engine → action and team
graph.add_node("assign", assign)        # picker and SLA → assignee, due date
graph.add_node("review", human_review)  # interrupt(); resumes on UI action
graph.add_node("commit", commit)        # write Decision, audit, outbox row
# edges: intake → validate → (classify | policy) → policy → (assign | review) → commit
```

- **Fast path:** a per-source config flag skips `classify` for sources with rich structured fields.
- **Human review:** `human_review` calls `interrupt({"decision": draft})`. The API resumes the graph with `Command(resume=human_choice)` by enqueuing a Procrastinate job, so the HTTP request never runs the graph itself.
- **Timeouts:** each node has a timeout and a LangGraph `RetryPolicy`. LLM failure degrades the ticket to `review`; it never drops it.
- **Nodes are thin:** each node is a few lines that call a pure function from `core/` and an adapter from `ports.py`. Unit-test the functions, integration-test the graph.

---

## 8. Connectors (adapter contract)

```python
class SourceConnector(Protocol):
    name: str
    def fetch(self, since: datetime | None) -> AsyncIterator[RawRecord]: ...
    async def fingerprint(self) -> SchemaFingerprint: ...
    async def write_back(self, op: WriteOp, idempotency_key: str) -> WriteResult: ...
    async def health(self) -> HealthStatus: ...
```

| Connector | How it reads | How it writes | Notes |
| --- | --- | --- | --- |
| **Jira** | Webhook (preferred) or JQL poll (`/rest/api/3/search/jql` with `nextPageToken` on Cloud) | REST v2/v3: assign, labels, comment, transition | Own small httpx client. Ship a permission self-check that calls `GET /mypermissions` and lists what's missing, for example `EDIT_ISSUES` or `ASSIGN_ISSUES`. |
| **SQL** | Poll a **stable view**, never base tables, using a watermark column (plus tie-breaker id) | Optional writes to a status table | Read-only database user, parameterised queries only. SQL Server via `aioodbc` + Microsoft ODBC driver, Postgres via psycopg 3. |
| **Webhook** | `POST /ingest/{source}` with HMAC signature (constant-time compare, timestamp to block replays) → `inbox`, 202 | Callback URL | |
| **CSV** | CLI import | None | For demos and backfills. |

Field mapping lives in config:

```yaml
source: jira-escalations
map:
  title: fields.summary
  region: fields.customfield_10231.value   # use field IDs, not display names
  severity: { from: fields.priority.name, translate: { Highest: sev1, High: sev2, Medium: sev3, Low: sev4 } }
required: [title, region]
```

---

## 9. Security and compliance checklist

- Secrets come only from environment variables or a secret manager; there is a `.env.example` but no real `.env` in git.
- Every service account gets the least privilege it needs. Document the exact permissions per connector.
- PII redaction runs before any LLM call (emails, phone numbers, configurable patterns), and the redaction map stays server-side. Optionally plug in Microsoft Presidio for richer entity detection.
- The LLM receives the minimum fields required. Prompts and outputs are logged with a retention setting.
- Treat ticket text as untrusted input to the LLM (prompt injection). Structured output plus "rules decide" limits the blast radius; never give the classifier tools.
- The API uses OIDC or SSO (generic OIDC provider via Authlib) with role-based access: `viewer`, `reviewer`, `rule-author`, `admin`.
- The audit log is append-only, enforced by a Postgres trigger that blocks updates and deletes, and the app's DB role has no `TRUNCATE` or trigger-altering rights.
- Supply chain: Dependabot, CodeQL, `pip-audit`, `npm audit`, SBOM (syft, CycloneDX) on release, cosign-signed container images with attestations.
- `SECURITY.md` sets out a private vulnerability reporting process (enable GitHub private vulnerability reporting).

---

## 10. Testing strategy

| Level | What | Tooling |
| --- | --- | --- |
| Unit | Rules evaluator (including property-based tests), picker strategies, SLA maths, mapping | pytest, hypothesis |
| Golden | Synthetic ticket → expected decision and full trace | YAML fixtures, run in CI |
| Contract | Each connector against recorded synthetic cassettes | pytest-recording, respx |
| Integration | Full pipeline against real Postgres, with a fake LLM | testcontainers, Pydantic AI `TestModel`/`FunctionModel` |
| Replay | `triagent replay --from <date>` re-runs past tickets with a new ruleset and diffs the decisions | CLI |
| Dry run | `triagent dry-run <ticket.json>` prints the decision and trace without writing | CLI |
| Canary | A single-ticket mode in production with a write allow-list | Config flag |
| UI unit | Components, stores, query composables | Vitest |
| UI e2e | Pipeline, review flow and rules editor | Playwright |
| LLM evals | Signal accuracy on a labelled synthetic set, tracked per prompt version | pytest + `pydantic-evals` |

**Coverage gates:** 90% or more on `core/`, 75% or more overall. CI fails if a ruleset change alters any golden decision without the golden file being updated in the same PR. CI also fails if `schemas/` or the frontend's generated API client is stale.

---

## 11. `CLAUDE.md` (put this in the repo root)

```markdown
# CLAUDE.md: standing instructions for this repo

## Project
Triagent: open-source escalation triage. Read docs/ARCHITECTURE.md before large changes.

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
- Frontend: `cd frontend && npm ci && npm run dev` · `npm run gen:api` · `npm test` · `npm run test:e2e`
- Seed data: `uv run triagent seed --company northwind --tickets 500`

## Workflow
- Plan first for anything touching more than 3 files; list files and tests before editing.
- Write or update tests in the same change. Run the relevant tests before saying done.
- Small PR-sized steps. Conventional commits (feat:, fix:, docs:, test:, refactor:).
- Update docs/ when behaviour or config changes.

## Style
- Python: typed, async I/O, Pydantic v2 models at boundaries, no bare except, timezone-aware datetimes only.
- Vue: <script setup lang="ts">, TanStack Query for server data, Pinia for UI state, design tokens from themes/, no inline colours.
- Charts: Chart.js 4 only; shared plugins live in components/charts/plugins/.
```

---

## 12. Build phases: prompts to paste into Claude Code

Run them in order. Each phase ends green (tests passing) and with a commit. Start every session with: *"Read CLAUDE.md and docs/ARCHITECTURE.md, then …"*

### Phase 0: Scaffold (½ day)
> Create the repo layout from section 4 of `docs/BUILD_PLAN.md`. Set up uv (Python 3.13), ruff, mypy, import-linter (core/ forbidden imports), pytest, pre-commit, Apache-2.0 LICENSE and NOTICE, CONTRIBUTING with DCO, SECURITY.md, docker-compose with Postgres 17, pydantic-settings and a Typer CLI stub, and a GitHub Actions CI workflow (lint, type-check, import contracts, test on 3.13 and 3.14). Add CLAUDE.md from section 11. No business logic yet. Make CI pass.

### Phase 1: Domain core and rules engine (2–3 days)
> Implement `core/models.py` (section 5) and the rules DSL (section 6) as Pydantic models: YAML loader (`safe_load`) validated against them, generated JSON Schema in `schemas/`, evaluator with Kleene tri-state outcomes, RE2 regex, layering, and a full trace. No `eval`. Add hypothesis property tests (for example, that missing fields never yield `pass`) and 20 golden tests using Northwind examples. Add CLI `triagent rules test` and `triagent schemas export`.

### Phase 2: Picker and SLA (2 days)
> Implement assignment strategies (round-robin, least-loaded, skill-match, follow-the-sun, sticky-owner) behind one interface, with capacity checks and an injected `Clock`. Implement SLA calendars (business hours, holidays, time zones via `zoneinfo`), due-date calculation and breach prediction. Unit-test the edge cases: daylight-saving changes, weekends, zero capacity.

### Phase 3: Persistence, queue and outbox (2 days)
> Add SQLAlchemy 2.0 async models (psycopg 3) and Alembic migrations for inbox, tickets, decisions, audit (append-only trigger), rulesets, assignees/capacity and outbox. Wire up Procrastinate (its own migrations) for ingest, pipeline and outbox tasks plus periodic tasks, with a per-ticket queueing lock. Implement the capacity lock for assignment with `SELECT … FOR UPDATE SKIP LOCKED`. Integration tests against real Postgres via testcontainers.

### Phase 4: LangGraph pipeline (3 days)
> Build the graph from section 7 in `pipeline/` with the Postgres checkpointer, a per-ticket thread_id, node timeouts and `RetryPolicy`, `interrupt()` for review, and resume via `Command` from a Procrastinate task. Add the `LLMProvider` protocol with a deterministic fake for tests and a Pydantic AI adapter that returns `Signal` as structured output (OpenAI-compatible, Anthropic and Ollama configured by settings). Add PII redaction before LLM calls. Add `triagent dry-run` and `triagent replay`.

### Phase 5: Connectors (3–4 days)
> Implement the Jira connector with httpx (webhook and JQL poll, write-back ops, permission self-check), the SQL view poller (watermark plus tie-breaker, read-only), webhook ingest with HMAC and replay protection writing to the inbox, and CSV import. Add config-driven field mapping and schema fingerprinting with drift alerts. Write contract tests with synthetic cassettes only (pytest-recording, respx).

### Phase 6: API (2 days)
> Build FastAPI routers for tickets, decisions, the review queue (accept/override/redirect enqueues a resume job), rulesets (draft, validate, publish, roll back), SLA, metrics, admin and modes (shadow/assist/auto per queue). Add an SSE stream fed by Postgres LISTEN/NOTIFY (sse-starlette), OIDC auth with roles via Authlib, and OpenAPI docs. Add a CI check that the exported OpenAPI spec is current.

### Phase 7: Dashboard (4–5 days)
> Build the Vue 3 + TS + Vite UI on Node 24 with a generated openapi-fetch client, TanStack Query for server state (SSE events invalidate queries), Pinia for UI state and Chart.js 4. Views: Pipeline (live animated flow), Review queue (optimistic accept/override/redirect), Rules editor (CodeMirror 6 YAML with JSON-Schema validation and a golden-test run button), SLA, Insights, Admin. Add three themes (atlas, nebula, slate) as CSS design tokens. Write shared Chart.js plugins (gloss, gauge needle, centre text, crosshair, heatmap cells) and an HTML tooltip. Support reduced motion and keyboard access. Add Vitest unit tests and Playwright e2e for the review flow.

### Phase 8: Hardening and release (2–3 days)
> Add OpenTelemetry traces (with GenAI conventions for LLM spans), Prometheus metrics, structlog JSON logs with trace ids, a multi-stage Dockerfile (uv build, slim non-root runtime), a compose "demo" profile with Keycloak and seeded Northwind data, the docs site, CodeQL, Dependabot, syft SBOM, cosign-signed images and a v0.1.0 release workflow. README: a GIF, a 5-minute quickstart, and an architecture diagram.

**Total:** about 4–5 weeks part-time for one developer with Claude Code. Procrastinate and Pydantic AI should claw back a day or two from phases 3 and 4.

---

## 13. Working effectively with Claude Code

- **One phase per session.** Start each with "Read CLAUDE.md and the plan section for Phase N. Propose a file-by-file plan before editing."
- **Ask for tests first** on core logic: "Write failing golden tests for these 5 scenarios, then implement until they pass."
- **Keep the plan in the repo.** Commit this file as `docs/BUILD_PLAN.md` and tick off phases as you go.
- **Use plan mode** for cross-cutting changes such as schema changes or new connectors.
- **Review every diff** that touches security, auth, the outbox or write-back paths yourself.
- **Use the CLI as the check.** `triagent dry-run` and `triagent replay` are how you and Claude verify behaviour without touching real systems.
- **Never paste real company data** into prompts or fixtures. Use `scripts/seed_synthetic.py`.

---

## 14. Open-source launch checklist

- [ ] Name is clear of trademark clashes; GitHub org and PyPI/npm names reserved
- [ ] Employer approval on file, if required
- [ ] Apache-2.0 LICENSE, NOTICE, CONTRIBUTING (DCO), CODE_OF_CONDUCT, SECURITY
- [ ] README: problem, demo GIF, quickstart (`docker compose --profile demo up`), architecture, roadmap
- [ ] Synthetic Northwind demo works from a clean clone in under 5 minutes
- [ ] Docs site published (GitHub Pages)
- [ ] Issue templates, PR template and "good first issue" labels
- [ ] v0.1.0 tagged with release notes, SBOM and signed images
- [ ] Roadmap issues: ServiceNow and Zendesk connectors, Helm chart, multi-tenant mode, DataRobot/MLflow model-registry adapter

---

## 15. Roadmap after v1

| Version | Additions |
| --- | --- |
| **v1.1** | Helm chart, ServiceNow connector, Teams/Slack approvals in the review queue |
| **v1.2** | Rule-tuning recommendations from human overrides, A/B testing of rulesets in shadow mode |
| **v1.3** | Model-registry adapters (DataRobot, MLflow) for governed classifier deployment; optional Redis/NATS event bus for very high volume |
| **v2.0** | Multi-tenant mode (Postgres row-level security), plugin marketplace for connectors and picker strategies |
