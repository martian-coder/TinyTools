import sys
from pathlib import Path

# Make backend importable from tests/
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from models import AgentModel, LedgerEntry


def make_agent(role_title: str, **kwargs) -> AgentModel:
    return AgentModel(
        id=f"test-{role_title[:8].lower().replace(' ', '-')}",
        role_title=role_title,
        owner_label=kwargs.get("owner_label", role_title),
        deadline="end of week",
    )


def make_entry(agent_id: str, fact: str, source_ref: str, as_of: str = "2024-01-15",
               source: str = "ticket") -> LedgerEntry:
    return LedgerEntry(
        id=f"entry-{source_ref}",
        agent_id=agent_id,
        fact=fact,
        source=source,
        source_ref=source_ref,
        as_of=as_of,
    )
