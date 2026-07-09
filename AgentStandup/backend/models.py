from sqlalchemy import Column, String, Text, Integer, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from database import Base


def _uuid():
    return str(uuid4())


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, default=_uuid)
    update_text = Column(Text, nullable=False)
    status = Column(String, default="pending")  # pending | running | complete | failed
    created_at = Column(DateTime, default=datetime.utcnow)

    turns = relationship("Turn", back_populates="meeting", order_by="Turn.seq")
    briefings = relationship("Briefing", back_populates="meeting")


class AgentModel(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=_uuid)
    role_title = Column(String, nullable=False)   # "Billing Service Owner"
    owner_label = Column(String)                  # role description for briefing header
    deadline = Column(String)                     # "end of week" etc.
    sort_order = Column(Integer, default=0)
    personality_file = Column(String)             # e.g. "billing.md" in backend/agents/

    ledger_entries = relationship("LedgerEntry", back_populates="agent",
                                  order_by="LedgerEntry.as_of")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String, primary_key=True, default=_uuid)
    agent_id = Column(String, ForeignKey("agents.id"))
    fact = Column(Text, nullable=False)           # one atomic, checkable statement
    source = Column(String)                       # ticket | incident | slo | postmortem | manual
    source_ref = Column(String)                   # BILL-4471, INC-2023-11-04
    as_of = Column(String)                        # ISO date

    agent = relationship("AgentModel", back_populates="ledger_entries")


class Turn(Base):
    __tablename__ = "turns"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    seq = Column(Integer, default=0)              # ordering within meeting
    speaker_id = Column(String)                   # agent id or "host"
    speaker_label = Column(String)                # role title or "Host"
    round = Column(Integer, default=0)
    kind = Column(String)                         # update | contradict | question | pass | answer | unknown
    text = Column(Text, default="")
    basis = Column(Text, default="")              # exact ledger fact for contradictions
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="turns")


class Briefing(Base):
    __tablename__ = "briefings"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    agent_id = Column(String, ForeignKey("agents.id"))
    role_title = Column(String)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    meeting = relationship("Meeting", back_populates="briefings")


class StabilityRun(Base):
    """One independent agent evaluation (no shared transcript)."""
    __tablename__ = "stability_runs"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    agent_id = Column(String, ForeignKey("agents.id"))
    run_index = Column(Integer)
    kind = Column(String)
    text = Column(Text)
    basis = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class StabilityCluster(Base):
    """Clustered objections across N stability runs."""
    __tablename__ = "stability_clusters"

    id = Column(String, primary_key=True, default=_uuid)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    agent_id = Column(String, ForeignKey("agents.id"))
    role_title = Column(String)
    description = Column(Text)
    stability_pct = Column(Float)               # fraction of N runs that produced this cluster
    representative_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class AccuracyMark(Base):
    """Post-meeting ground truth: was this objection actually raised in the real meeting?"""
    __tablename__ = "accuracy_marks"

    id = Column(String, primary_key=True, default=_uuid)
    cluster_id = Column(String, ForeignKey("stability_clusters.id"))
    was_raised = Column(Boolean)
    marked_at = Column(DateTime)
