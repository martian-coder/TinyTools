import json
import os
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv()

from database import get_db, create_tables
from models import Meeting, AgentModel, LedgerEntry, Turn, Briefing, StabilityCluster
from pipeline import run_meeting, run_stability_engine
from seed import seed

app = FastAPI(title="Agent Standup")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
SEED_UPDATE = (Path(__file__).parent / "ledgers" / "seed_update.txt").read_text().strip()


@app.on_event("startup")
def startup():
    create_tables()
    seed()


# --------------------------------------------------------------------------- #
# Static frontend                                                              #
# --------------------------------------------------------------------------- #

@app.get("/")
def root():
    return FileResponse(FRONTEND_DIR / "index.html")


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# --------------------------------------------------------------------------- #
# API                                                                         #
# --------------------------------------------------------------------------- #

class CreateMeetingRequest(BaseModel):
    update_text: str


@app.post("/meetings")
def create_meeting(body: CreateMeetingRequest, db: Session = Depends(get_db)):
    meeting = Meeting(id=str(uuid4()), update_text=body.update_text.strip())
    db.add(meeting)
    db.commit()
    return {"meeting_id": meeting.id}


@app.get("/meetings/{meeting_id}")
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Not found")
    turns = [
        {
            "id": t.id,
            "speaker_id": t.speaker_id,
            "speaker_label": t.speaker_label,
            "round": t.round,
            "kind": t.kind,
            "text": t.text,
            "basis": t.basis or "",
            "seq": t.seq,
        }
        for t in meeting.turns
    ]
    briefings = [
        {"role_title": b.role_title, "text": b.text}
        for b in meeting.briefings
    ]
    return {
        "meeting_id": meeting.id,
        "status": meeting.status,
        "update_text": meeting.update_text,
        "turns": turns,
        "briefings": briefings,
    }


@app.get("/meetings/{meeting_id}/stream")
async def stream_meeting(meeting_id: str):
    db_gen = get_db()
    db = next(db_gen)

    async def generate():
        try:
            async for event in run_meeting(meeting_id, db):
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/meetings/{meeting_id}/stability")
async def trigger_stability(meeting_id: str):
    """Run the stability engine for this meeting (Phase 2)."""
    db_gen = get_db()
    db = next(db_gen)

    async def generate():
        try:
            async for event in run_stability_engine(meeting_id, db):
                yield f"data: {json.dumps(event)}\n\n"
        finally:
            try:
                next(db_gen)
            except StopIteration:
                pass

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/meetings/{meeting_id}/stability")
def get_stability(meeting_id: str, db: Session = Depends(get_db)):
    clusters = (
        db.query(StabilityCluster)
        .filter(StabilityCluster.meeting_id == meeting_id)
        .order_by(StabilityCluster.stability_pct.desc())
        .all()
    )
    return {
        "meeting_id": meeting_id,
        "clusters": [
            {
                "role_title": c.role_title,
                "description": c.description,
                "stability_pct": c.stability_pct,
                "representative_text": c.representative_text,
            }
            for c in clusters
        ],
    }


@app.get("/agents")
def list_agents(db: Session = Depends(get_db)):
    agents = db.query(AgentModel).order_by(AgentModel.sort_order).all()
    result = []
    for a in agents:
        entries = db.query(LedgerEntry).filter(LedgerEntry.agent_id == a.id).all()
        result.append({
            "id": a.id,
            "role_title": a.role_title,
            "owner_label": a.owner_label,
            "personality_file": a.personality_file,
            "ledger": [
                {
                    "id": e.id,
                    "fact": e.fact,
                    "source": e.source,
                    "source_ref": e.source_ref,
                    "as_of": e.as_of,
                }
                for e in entries
            ],
        })
    return result


@app.get("/seed-update")
def get_seed_update():
    return {"text": SEED_UPDATE}
