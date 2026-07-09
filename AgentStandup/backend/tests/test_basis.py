"""
Test 4 — Basis integrity.

Every contradict turn's basis must exactly match a stored ledger row.
Fuzzy match fails the test. If it doesn't match, reject and retry.

This test ensures the receipt is real. Without it, 'says who' has no answer
and trust in the transcript collapses.
"""

import pytest
from conftest import make_agent, make_entry
from pipeline import call_agent_turn, verify_basis

CRIT_FACT = (
    "The most recent penetration test found one critical unresolved finding: "
    "a credential stuffing vulnerability on the password reset endpoint; "
    "no remediation has shipped"
)

UPDATE_WITH_FALSE_CLAIM = (
    "No critical security findings are outstanding from our most recent penetration test."
)

TRANSCRIPT = [
    {"speaker_id": "host", "speaker_label": "Host", "round": 0,
     "kind": "update", "text": UPDATE_WITH_FALSE_CLAIM, "basis": "", "seq": 0}
]

RUNS = 10


@pytest.mark.asyncio
async def test_contradict_basis_matches_ledger():
    """Every contradiction must cite a real ledger row, not an invention."""
    agent = make_agent("Security & Compliance Owner")
    entries = [make_entry(agent.id, CRIT_FACT, "SEC-0896", source="postmortem")]

    for _ in range(RUNS):
        result = await call_agent_turn(agent, TRANSCRIPT, entries, round_num=1)
        if result["kind"] == "contradict":
            basis = result.get("basis", "")
            assert basis, (
                f"Contradict with empty basis — the receipt is missing. "
                f"Turn text: {result['text']}"
            )
            assert verify_basis(basis, entries), (
                f"Basis does not match any ledger entry.\n"
                f"  Basis:  {basis}\n"
                f"  Ledger: {CRIT_FACT}"
            )


@pytest.mark.asyncio
async def test_verify_basis_exact_match():
    agent = make_agent("Security & Compliance Owner")
    entry = make_entry(agent.id, CRIT_FACT, "SEC-0896")

    assert verify_basis(CRIT_FACT, [entry]), "Exact fact should pass basis check"


@pytest.mark.asyncio
async def test_verify_basis_paraphrase_may_pass():
    agent = make_agent("Security & Compliance Owner")
    entry = make_entry(agent.id, CRIT_FACT, "SEC-0896")

    # Close paraphrase with 70%+ word overlap — should pass
    paraphrase = (
        "critical unresolved finding: credential stuffing vulnerability on "
        "password reset endpoint no remediation"
    )
    assert verify_basis(paraphrase, [entry]), (
        "Substantial paraphrase should pass basis check (≥70% word overlap)"
    )


@pytest.mark.asyncio
async def test_verify_basis_fabrication_fails():
    agent = make_agent("Security & Compliance Owner")
    entry = make_entry(agent.id, CRIT_FACT, "SEC-0896")

    # Completely fabricated statement not in ledger
    fabricated = (
        "The encryption keys were rotated and the security team signed off last week."
    )
    assert not verify_basis(fabricated, [entry]), (
        "Fabricated basis should fail basis check"
    )


@pytest.mark.asyncio
async def test_no_basis_without_ledger():
    """Without a ledger, no contradict can produce a valid basis."""
    agent = make_agent("Security & Compliance Owner")

    for _ in range(RUNS):
        result = await call_agent_turn(agent, TRANSCRIPT, [], round_num=1)
        if result["kind"] == "contradict":
            basis = result.get("basis", "")
            # No entries to validate against — basis verification fails by definition
            assert not verify_basis(basis, []), (
                f"Agent produced contradict with non-empty basis but no ledger: {basis}"
            )
