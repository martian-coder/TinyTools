"""
Test 1 — Ledger ablation.

Remove the ledger line that grounds a known contradiction.
Re-run. The contradiction MUST disappear.

If it survives, the agent is confabulating from the document and every
contradiction ever shipped is suspect. This is the most important test.
"""

import pytest
import asyncio
from conftest import make_agent, make_entry
from pipeline import call_agent_turn

UPDATE = (
    "The 3DS2 strong authentication upgrade is scheduled for the February release cycle."
)
TRANSCRIPT = [{"speaker_id": "host", "speaker_label": "Host", "round": 0,
               "kind": "update", "text": UPDATE, "basis": "", "seq": 0}]

ROLLBACK_FACT = (
    "The 3DS2 strong authentication integration was rolled back on 2024-01-08 due to a "
    "23% cart abandonment spike in the first 6 hours of rollout"
)

RUNS = 6  # enough to detect confabulation statistically


@pytest.mark.asyncio
async def test_contradiction_appears_with_ledger():
    agent = make_agent("Billing Service Owner")
    entries = [make_entry(agent.id, ROLLBACK_FACT, "INC-2024-0021", source="incident")]

    kinds = [
        (await call_agent_turn(agent, TRANSCRIPT, entries, round_num=1))["kind"]
        for _ in range(RUNS)
    ]
    assert "contradict" in kinds, (
        f"Agent with rollback fact never contradicted the update. Kinds: {kinds}"
    )


@pytest.mark.asyncio
async def test_contradiction_disappears_without_ledger():
    """
    The ablation test. No ledger → no contradiction.
    If the agent still contradicts, it is inventing facts from the update text.
    """
    agent = make_agent("Billing Service Owner")

    kinds = [
        (await call_agent_turn(agent, TRANSCRIPT, [], round_num=1))["kind"]
        for _ in range(RUNS)
    ]
    assert "contradict" not in kinds, (
        f"Agent contradicted without any ledger entry — confabulation detected. "
        f"Kinds: {kinds}\n"
        f"This means agents are inventing disagreement, not reading from private facts. "
        f"Fix the prompt before shipping."
    )


@pytest.mark.asyncio
async def test_different_fact_does_not_produce_same_contradiction():
    """
    Replace the rollback fact with an unrelated fact.
    The specific 3DS2 contradiction must not appear.
    """
    agent = make_agent("Billing Service Owner")
    unrelated = make_entry(
        agent.id,
        "Payment processor contract renewal is due 2024-03-12",
        "BILL-4471",
    )

    results = [
        await call_agent_turn(agent, TRANSCRIPT, [unrelated], round_num=1)
        for _ in range(RUNS)
    ]

    for r in results:
        if r["kind"] == "contradict":
            # Any contradiction should reference the contract, not the rollback
            basis_lower = r.get("basis", "").lower()
            assert "rollback" not in basis_lower and "cart abandonment" not in basis_lower, (
                f"Agent cited rollback facts it doesn't have. Basis: {r['basis']}"
            )
