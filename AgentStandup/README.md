# Agent Standup

A tool where role-grounded AI delegates attend a meeting on behalf of absent humans, surface contradictions against private state, and send each human a private briefing of what was said in their name.

---

## The thesis in one sentence

The value is not the conversation. The value is **information asymmetry surfacing as contradiction**. If every agent reads the same document, this produces elaborate paraphrase. The ledgers are the entire moat.

---

## Research foundation

Three findings from the literature directly shaped design decisions:

**Deliberative Illusion** (arxiv 2606.03032) — Multi-agent systems create false consensus when agents share reasoning context. The private ledger is the architectural countermeasure: agents can only contradict from specific, checkable facts they alone hold.

**Stability via independence** (arxiv 2510.12697) — Running N independent evaluations with no shared transcript separates signal from sampling noise better than any single-run confidence score. This motivates the Phase 2 stability engine: 12 parallel runs, cluster by underlying issue, report the percentage.

**Information asymmetry in deliberation** (arxiv 2607.01661) — Agents with diverse private evidence measurably outperform shared-corpus agents. This validates the entire product thesis. Homogeneous evidence produces homogeneous output.

---

## Architecture

```
POST /meetings
  → host presents update
  → for round in 1..2:
      for agent in [billing, platform, security, data]:
        agent.turn(transcript, ledger) → contradict | question | pass
        if not pass: host.reply(update, transcript) → answer | unknown
  → for agent in agents: private_briefing(agent, transcript)
  → persist, deliver
```

**Sequential turns are load-bearing.** Agent 3 must see what agents 1 and 2 said. Parallelising the turn loop breaks this. The stability engine is the opposite — 12 runs in parallel because independence is what makes the percentage meaningful.

---

## The four invariants

Violating any one produces a system that sounds excellent and tells you nothing.

1. **The host may not invent facts.** When the update doesn't answer a question, `kind: "unknown"`. An honest gap is more valuable than a confident answer.

2. **Every contradiction cites its ledger line.** The `basis` field renders as a receipt. Without it, readers can't answer *says who*, and trust collapses.

3. **Agents are grounded in roles, never individuals.** `"Billing Service Owner"`, never a name. Ledgers come from tickets and incidents, never from people's messages.

4. **Agents may not be constructive.** Prompts forbid suggestions, fixes, and pleasantries. Missing facts are what humans can't think of. Obvious fixes are not.

---

## The seed scenario

The seed update (`ledgers/seed_update.txt`) contains seven direct contradictions with the seed ledgers:

| Claim in update | Ledger fact | Source |
|---|---|---|
| "3DS2 scheduled for February" | Rolled back 2024-01-08, 23% cart abandonment | INC-2024-0021 |
| "P95 within SLO for 30 days" | Above SLO for 11 consecutive days | SLO-API-002 |
| "SOC2 planned for H2" | Audit window opens in 6 weeks | SEC-0891 |
| "99.8% data pipeline uptime" | Silently dropping 2–3% of events since Dec 15 | DATA-1102 |
| "ML feature store ready" | Contains 14 stale features from abandoned project | DATA-1099 |
| "No critical security findings" | Credential stuffing on reset endpoint, unpatched | SEC-0896 |
| "Database migration on schedule" | Redis at 23% headroom, 6 weeks to saturation | PLAT-2201 |

This update sounds fine in a meeting. It is wrong in seven ways. Run the tool before your next retro.

---

## Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Add ANTHROPIC_API_KEY to .env

uvicorn main:app --reload
# Open http://localhost:8000
```

Database seeded automatically on first run with the four hand-written ledgers.

To use Postgres: `DATABASE_URL=postgresql://user:pass@host/standup uvicorn main:app`

---

## Tests

These are the tests that matter. Unit tests on JSON parsing are table stakes.

```bash
cd backend
pytest tests/ -v
```

**Test 1 — Ledger ablation** (`test_ablation.py`): Remove the ledger line grounding a known contradiction. Re-run. The contradiction must disappear. If it survives, the agent is confabulating and every contradiction you've ever shipped is suspect.

**Test 2 — Host honesty** (`test_host_honesty.py`): Feed an update that omits the rollback plan. Assert `kind == "unknown"`. Assert no date, number, or weasel word appears in the reply.

**Test 3 — Symmetric control** (`test_symmetric.py`): Give every agent the same benign ledger. Contradiction rate must collapse below 10%. If agents invent disagreement, the product is theatre.

**Test 4 — Basis integrity** (`test_basis.py`): Every `contradict` turn's basis must match a stored ledger row at ≥70% word overlap. Empty basis fails the test. The receipt must be real.

---

## Build order

- **Week 1** — Turn loop, four ledgers, one update, transcript to stdout. No UI. Run tests 1 and 3. If test 3 fails, stop and fix prompts.
- **Week 2** — React transcript with contradiction and unknown markers, streaming. Briefings.
- **Week 3** — Postgres. Ledger CRUD. Real ledgers from one real team.
- **Week 4** — Stability engine and the percentage (`POST /meetings/{id}/stability`).
- **Week 5+** — Accuracy loop. Ingest from Jira and PagerDuty.

Do not build: avatars, voice, live human participation, agent memory across meetings, or any orchestration framework.

---

## Phase 2: Stability engine

```
POST /meetings/{id}/stability
```

Runs each agent 12 times independently, in parallel, with no shared transcript. Clusters objections. Reports stability percentage per cluster. Suppresses anything below 40%.

```
"This objection surfaced in 11 of 12 runs."
```

That number is what survives procurement. A single meeting gives plausible sentences with no way to separate insight from noise. Twelve gives a distribution.

---

## Phase 3: Accuracy loop

After the real meeting, mark which predicted objections were actually raised. Store it. Report precision over time, per role.

> "Of the objections we flagged above 80% stability last quarter, 71% were raised in the room."

That sentence closes enterprise deals. Nothing in the UI does.

---

## Ledger quality

The agents are commodity. **Quality of ledgers determines quality of output completely.**

One fact per row. Every fact must be checkable against a system of record. If you cannot name the ticket, it is a belief. Facts the host also knows are worthless — asymmetry or nothing. Stale facts are worse than absent ones.

Seed by hand for v1. Ingest from Jira/PagerDuty/Confluence in v2.

---

## Prompts

Prompts are in `backend/prompts/` as version-controlled text files. They are the product, not the code.

- `agent_turn.txt` — agent receives role + ledger + transcript, returns contradict | question | pass
- `host_reply.txt` — host receives update only, returns answer | unknown, may not hedge or invent
- `briefing.txt` — private briefing per absent human: what was said in their name, what they were committed to
- `stability_run.txt` — independent single-run evaluation with no transcript context
