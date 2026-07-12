"""
Test 3 — Symmetric control.

Give every agent the SAME ledger (a benign, non-contradicting fact).
Contradiction count must collapse toward zero.

If it doesn't, agents are inventing disagreement, and the product is theatre.
This test must pass before building anything else.
"""

import pytest
from conftest import make_agent, make_entry
from pipeline import call_agent_turn

# A fact that does not contradict anything about migrations or platform health
BENIGN_FACT = (
    "The engineering team successfully completed the on-call rotation documentation update"
)

UPDATE = (
    "We are on track to complete the payments infrastructure migration by end of Q2. "
    "The 3DS2 upgrade is scheduled for February. API platform is stable within SLO."
)

TRANSCRIPT = [{"speaker_id": "host", "speaker_label": "Host", "round": 0,
               "kind": "update", "text": UPDATE, "basis": "", "seq": 0}]

AGENTS = [
    "Billing Service Owner",
    "Platform & Infrastructure Owner",
    "Security & Compliance Owner",
    "Data & Analytics Owner",
]

RUNS_PER_AGENT = 4
MAX_CONTRADICTION_RATE = 0.10  # 10% — accounts for rare model misbehaviour


@pytest.mark.asyncio
async def test_symmetric_ledger_suppresses_contradictions():
    """
    Identical, non-contradicting fact given to all agents.
    Contradiction rate must be < 10%.
    """
    total = 0
    contradictions = 0

    for role in AGENTS:
        agent = make_agent(role)
        entry = make_entry(agent.id, BENIGN_FACT, "SHARED-001")

        for _ in range(RUNS_PER_AGENT):
            result = await call_agent_turn(agent, TRANSCRIPT, [entry], round_num=1)
            total += 1
            if result["kind"] == "contradict":
                contradictions += 1

    rate = contradictions / total
    assert rate <= MAX_CONTRADICTION_RATE, (
        f"Symmetric ledger produced {contradictions}/{total} contradictions "
        f"({rate:.0%}). "
        f"Agents are inventing disagreement — the product is theatre. "
        f"Fix the prompts before building further."
    )


@pytest.mark.asyncio
async def test_empty_ledger_produces_pass_or_question_not_contradict():
    """
    No ledger at all. Contradiction must be impossible.
    Questions are acceptable (the update may invite them). Contradiction is not.
    """
    total = 0
    contradictions = 0

    for role in AGENTS:
        agent = make_agent(role)
        for _ in range(RUNS_PER_AGENT):
            result = await call_agent_turn(agent, TRANSCRIPT, [], round_num=1)
            total += 1
            if result["kind"] == "contradict":
                contradictions += 1

    assert contradictions == 0, (
        f"Agents produced {contradictions}/{total} contradictions with an empty ledger. "
        f"This is confabulation. The basis field will be empty or fabricated."
    )
