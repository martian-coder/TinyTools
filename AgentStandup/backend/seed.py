"""
Load hand-written ledgers and seed agents into the database.
Run once: python seed.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import SessionLocal, create_tables
from models import AgentModel, LedgerEntry

LEDGERS_DIR = Path(__file__).parent / "ledgers"


def seed():
    create_tables()
    db = SessionLocal()

    try:
        existing = db.query(AgentModel).count()
        if existing > 0:
            print(f"Database already seeded ({existing} agents). Skipping.")
            return

        for path in sorted(LEDGERS_DIR.glob("*.json")):
            data = json.loads(path.read_text())
            agent = AgentModel(
                role_title=data["role_title"],
                owner_label=data.get("owner_label", data["role_title"]),
                deadline=data.get("deadline", "end of week"),
                sort_order=data.get("sort_order", 99),
            )
            db.add(agent)
            db.flush()

            for fact_data in data["facts"]:
                entry = LedgerEntry(
                    agent_id=agent.id,
                    fact=fact_data["fact"],
                    source=fact_data.get("source", "manual"),
                    source_ref=fact_data.get("source_ref", ""),
                    as_of=fact_data.get("as_of", ""),
                )
                db.add(entry)

            print(f"  Seeded: {agent.role_title} ({len(data['facts'])} facts)")

        db.commit()
        print("Seed complete.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
