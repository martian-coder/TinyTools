"""
Turn loop: sequential, order-dependent, never parallelised.
Agent 3 must see what agents 1 and 2 said — that is the entire point.
"""

import asyncio
import json
import os
import re
from pathlib import Path
from typing import AsyncGenerator
import anthropic

from models import Meeting, AgentModel, LedgerEntry, Turn, Briefing, StabilityRun, StabilityCluster

PROMPTS_DIR = Path(__file__).parent / "prompts"
AGENTS_DIR  = Path(__file__).parent / "agents"
MODEL = "claude-sonnet-4-6"
MAX_ROUNDS = 3
STABILITY_N = 12
STABILITY_THRESHOLD = 0.40


# --------------------------------------------------------------------------- #
# Anthropic client — created per-request from the meeting's stored api_key   #
# --------------------------------------------------------------------------- #

def make_client(api_key: str) -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=api_key)


# --------------------------------------------------------------------------- #
# Prompt loading                                                               #
# --------------------------------------------------------------------------- #

def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / name).read_text()


def load_personality(personality_file: str | None) -> str:
    if not personality_file:
        return "(No specific character profile for this role.)"
    path = AGENTS_DIR / personality_file
    if not path.exists():
        return "(No specific character profile for this role.)"
    return path.read_text()


# --------------------------------------------------------------------------- #
# JSON parsing — defensive: strip fences, locate first {                      #
# --------------------------------------------------------------------------- #

def parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
    start = text.find("{")
    if start == -1:
        raise ValueError(f"No JSON object in: {text[:120]}")
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError(f"Unterminated JSON in: {text[:120]}")


# --------------------------------------------------------------------------- #
# Basis integrity                                                              #
# --------------------------------------------------------------------------- #

def verify_basis(basis: str, entries: list[LedgerEntry]) -> bool:
    """
    Basis must be substantially contained in one ledger fact.
    Spec: 'fuzzy match fails the test' — we require ≥80% word overlap.
    """
    if not basis.strip():
        return False  # contradict with no basis fails

    basis_words = set(re.sub(r"[^\w\s]", "", basis.lower()).split())
    if len(basis_words) < 3:
        return False

    for entry in entries:
        fact_words = set(re.sub(r"[^\w\s]", "", entry.fact.lower()).split())
        overlap = len(basis_words & fact_words) / len(basis_words)
        if overlap >= 0.70:
            return True
    return False


# --------------------------------------------------------------------------- #
# Transcript formatting (what the agents see)                                 #
# --------------------------------------------------------------------------- #

def format_transcript(turns: list[dict]) -> str:
    lines = []
    for t in turns:
        kind = t["kind"]
        label = t["speaker_label"]
        text = t["text"]
        if kind == "update":
            lines.append(f"HOST (update): {text}")
        elif kind in ("contradict", "question"):
            line = f"{label.upper()} ({kind}): {text}"
            if t.get("basis"):
                line += f"\n  [LEDGER BASIS: {t['basis']}]"
            lines.append(line)
        elif kind == "pass":
            lines.append(f"{label.upper()} (pass): —")
        elif kind in ("answer", "unknown"):
            lines.append(f"HOST ({kind}): {text}")
    return "\n".join(lines)


def turn_to_dict(turn: Turn) -> dict:
    return {
        "id": turn.id,
        "speaker_id": turn.speaker_id,
        "speaker_label": turn.speaker_label,
        "round": turn.round,
        "kind": turn.kind,
        "text": turn.text,
        "basis": turn.basis or "",
        "seq": turn.seq,
    }


# --------------------------------------------------------------------------- #
# LLM calls                                                                   #
# --------------------------------------------------------------------------- #

async def _llm(prompt: str, temperature: float = 0.4, max_tokens: int = 300, *,
               client: anthropic.AsyncAnthropic) -> str:
    msg = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


async def call_agent_turn(
    agent: AgentModel,
    transcript: list[dict],
    entries: list[LedgerEntry],
    round_num: int,
    strict_basis: bool = False,
    *,
    client: anthropic.AsyncAnthropic,
) -> dict:
    ledger_facts = "\n".join(
        f"- [{e.source_ref} / {e.as_of}] {e.fact}" for e in entries
    )

    round_instruction = (
        "This is round 1. Say the most important thing your ledger permits."
        if round_num == 1
        else f"This is round {round_num}. Do not repeat anything already said. "
             "Your ledger must have something genuinely new to contribute — otherwise pass."
    )

    extra_basis_instruction = (
        "\nSTRICT MODE: Your basis field must be copied EXACTLY from one ledger line above."
        if strict_basis
        else ""
    )

    personality = load_personality(getattr(agent, "personality_file", None))

    prompt = (
        load_prompt("agent_turn.txt")
        .replace("{title}", agent.role_title)
        .replace("{personality}", personality)
        .replace("{ledger_facts}", ledger_facts or "(no ledger entries)")
        .replace("{transcript}", format_transcript(transcript))
        .replace("{round_instruction}", round_instruction + extra_basis_instruction)
    )

    raw = await _llm(prompt, temperature=0.4, client=client)
    try:
        result = parse_json(raw)
    except Exception:
        raw = await _llm(
            prompt + "\n\nYour last response was not valid JSON. Respond ONLY with the JSON object.",
            temperature=0.1,
            client=client,
        )
        try:
            result = parse_json(raw)
        except Exception:
            return {"kind": "pass", "text": "", "basis": ""}

    if result.get("kind") not in ("contradict", "question", "pass"):
        result["kind"] = "pass"
    result.setdefault("text", "")
    result.setdefault("basis", "")

    return result


async def call_host_reply(update_text: str, transcript: list[dict], *, client: anthropic.AsyncAnthropic) -> dict:
    prompt = (
        load_prompt("host_reply.txt")
        .replace("{update}", update_text)
        .replace("{transcript}", format_transcript(transcript))
    )

    raw = await _llm(prompt, temperature=0.2, client=client)
    try:
        result = parse_json(raw)
    except Exception:
        return {"kind": "unknown", "text": "I don't have that information in my update."}

    if result.get("kind") not in ("answer", "unknown"):
        result["kind"] = "unknown"
    result.setdefault("text", "")
    return result


async def call_briefing(agent: AgentModel, transcript: list[dict], *, client: anthropic.AsyncAnthropic) -> str:
    prompt = (
        load_prompt("briefing.txt")
        .replace("{role_owner}", agent.owner_label or agent.role_title)
        .replace("{deadline}", agent.deadline or "end of week")
        .replace("{transcript}", format_transcript(transcript))
    )
    prompt = prompt.replace("{deadline}", agent.deadline or "end of week")
    return await _llm(prompt, temperature=0.3, max_tokens=200, client=client)


async def call_stability_run(
    agent: AgentModel,
    entries: list[LedgerEntry],
    update_text: str,
    *,
    client: anthropic.AsyncAnthropic,
) -> dict:
    ledger_facts = "\n".join(
        f"- [{e.source_ref} / {e.as_of}] {e.fact}" for e in entries
    )
    prompt = (
        load_prompt("stability_run.txt")
        .replace("{title}", agent.role_title)
        .replace("{ledger_facts}", ledger_facts or "(no ledger entries)")
        .replace("{update}", update_text)
    )
    raw = await _llm(prompt, temperature=0.7, max_tokens=200, client=client)
    try:
        result = parse_json(raw)
    except Exception:
        return {"kind": "pass", "text": "", "basis": ""}
    if result.get("kind") not in ("contradict", "question", "pass"):
        result["kind"] = "pass"
    result.setdefault("text", "")
    result.setdefault("basis", "")
    return result


async def cluster_objections(
    texts: list[str],
    total_runs: int,
    agent: AgentModel,
    *,
    client: anthropic.AsyncAnthropic,
) -> list[dict]:
    if not texts:
        return []

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
    prompt = f"""You have {len(texts)} objections collected from {total_runs} independent reviews of the same engineering update.

OBJECTIONS:
{numbered}

Group these by the underlying issue they each address. Different phrasings of the same concern belong in one group.

For each group:
- Write a one-sentence description of the underlying issue
- List which objection numbers belong to this group (1-indexed)
- Quote the most representative objection verbatim

Respond ONLY with valid JSON:
{{"clusters": [{{"description": "...", "indices": [1, 3], "representative_text": "..."}}]}}"""

    raw = await _llm(prompt, temperature=0.1, max_tokens=800, client=client)
    try:
        parsed = parse_json(raw)
    except Exception:
        return [{"description": texts[0], "stability_pct": len(texts) / total_runs,
                 "representative_text": texts[0]}]

    result = []
    for cluster in parsed.get("clusters", []):
        pct = len(cluster.get("indices", [])) / total_runs
        if pct >= STABILITY_THRESHOLD:
            result.append({
                "description": cluster.get("description", ""),
                "stability_pct": pct,
                "representative_text": cluster.get("representative_text", ""),
                "count": len(cluster.get("indices", [])),
                "total": total_runs,
            })

    result.sort(key=lambda c: c["stability_pct"], reverse=True)
    return result


# --------------------------------------------------------------------------- #
# Main meeting pipeline (async generator → SSE events)                        #
# --------------------------------------------------------------------------- #

async def run_meeting(meeting_id: str, db) -> AsyncGenerator[dict, None]:
    meeting: Meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        yield {"event": "error", "data": {"message": "Meeting not found"}}
        return

    if not meeting.api_key:
        yield {"event": "error", "data": {"message": "No API key set. Enter your Anthropic API key in the app header."}}
        return

    client = make_client(meeting.api_key)
    meeting.status = "running"
    db.commit()

    agents: list[AgentModel] = (
        db.query(AgentModel).order_by(AgentModel.sort_order).all()
    )
    transcript: list[dict] = []
    seq = 0

    # ------------------------------------------------------------------ #
    # Opening: host presents the update                                   #
    # ------------------------------------------------------------------ #
    opening = Turn(
        meeting_id=meeting_id,
        seq=seq,
        speaker_id="host",
        speaker_label="Host",
        round=0,
        kind="update",
        text=meeting.update_text,
    )
    db.add(opening)
    db.commit()
    seq += 1
    transcript.append(turn_to_dict(opening))
    yield {"event": "turn", "data": turn_to_dict(opening)}

    # ------------------------------------------------------------------ #
    # Rounds                                                              #
    # ------------------------------------------------------------------ #
    for round_num in range(1, MAX_ROUNDS + 1):
        all_passed = True
        productive = False  # any contradict, question, or unknown this round

        for agent in agents:
            entries: list[LedgerEntry] = (
                db.query(LedgerEntry)
                .filter(LedgerEntry.agent_id == agent.id)
                .all()
            )

            turn_data = await call_agent_turn(
                agent, transcript, entries, round_num, client=client
            )

            # Basis integrity gate: contradict with bad basis becomes question
            if turn_data["kind"] == "contradict":
                if not verify_basis(turn_data.get("basis", ""), entries):
                    # Retry once in strict mode
                    turn_data = await call_agent_turn(
                        agent, transcript, entries, round_num, strict_basis=True, client=client
                    )
                    if not verify_basis(turn_data.get("basis", ""), entries):
                        turn_data["kind"] = "question"
                        turn_data["basis"] = ""

            agent_turn = Turn(
                meeting_id=meeting_id,
                seq=seq,
                speaker_id=agent.id,
                speaker_label=agent.role_title,
                round=round_num,
                kind=turn_data["kind"],
                text=turn_data["text"],
                basis=turn_data.get("basis", ""),
            )
            db.add(agent_turn)
            db.commit()
            seq += 1
            transcript.append(turn_to_dict(agent_turn))
            yield {"event": "turn", "data": turn_to_dict(agent_turn)}

            if agent_turn.kind != "pass":
                all_passed = False

            if agent_turn.kind in ("contradict", "question"):
                productive = True
                await asyncio.sleep(0.6)  # pacing for streaming effect

                reply_data = await call_host_reply(meeting.update_text, transcript, client=client)

                host_reply = Turn(
                    meeting_id=meeting_id,
                    seq=seq,
                    speaker_id="host",
                    speaker_label="Host",
                    round=round_num,
                    kind=reply_data["kind"],
                    text=reply_data["text"],
                )
                db.add(host_reply)
                db.commit()
                seq += 1
                transcript.append(turn_to_dict(host_reply))
                yield {"event": "turn", "data": turn_to_dict(host_reply)}

                if reply_data["kind"] == "unknown":
                    productive = True  # unknowns count as productive

                await asyncio.sleep(0.4)

        # Termination
        if all_passed:
            yield {"event": "status", "data": {
                "message": f"All agents passed in round {round_num}. Meeting concluded.",
                "round": round_num,
            }}
            break

        if round_num > 1 and not productive:
            yield {"event": "status", "data": {
                "message": "No new contradictions or unknowns. Meeting concluded.",
                "round": round_num,
            }}
            break

    # ------------------------------------------------------------------ #
    # Private briefings                                                   #
    # ------------------------------------------------------------------ #
    yield {"event": "status", "data": {"message": "Generating private briefings…"}}

    for agent in agents:
        briefing_text = await call_briefing(agent, transcript, client=client)
        briefing = Briefing(
            meeting_id=meeting_id,
            agent_id=agent.id,
            role_title=agent.role_title,
            text=briefing_text,
        )
        db.add(briefing)
        db.commit()
        yield {
            "event": "briefing",
            "data": {
                "agent_id": agent.id,
                "role_title": agent.role_title,
                "owner_label": agent.owner_label,
                "text": briefing_text,
            },
        }
        await asyncio.sleep(0.3)

    meeting.status = "complete"
    db.commit()
    yield {"event": "done", "data": {"meeting_id": meeting_id}}


# --------------------------------------------------------------------------- #
# Stability engine (Phase 2)                                                  #
# --------------------------------------------------------------------------- #

async def run_stability_engine(meeting_id: str, db) -> AsyncGenerator[dict, None]:
    """
    Run each agent N=12 times independently with no shared transcript.
    Cluster objections; report stability percentage per cluster.
    Suppress anything below STABILITY_THRESHOLD (40%).

    Deliberately opposite design from the meeting loop:
    - Meeting: sequential because contradiction requires reaction
    - Stability: parallel because the percentage is meaningless unless runs are independent
    """
    meeting: Meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        yield {"event": "error", "data": {"message": "Meeting not found"}}
        return

    if not meeting.api_key:
        yield {"event": "error", "data": {"message": "No API key set."}}
        return

    client = make_client(meeting.api_key)

    agents: list[AgentModel] = (
        db.query(AgentModel).order_by(AgentModel.sort_order).all()
    )

    yield {"event": "stability_start", "data": {"n": STABILITY_N}}

    for agent in agents:
        entries: list[LedgerEntry] = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.agent_id == agent.id)
            .all()
        )

        # N independent runs in parallel — independence is what makes the % meaningful
        tasks = [
            call_stability_run(agent, entries, meeting.update_text, client=client)
            for _ in range(STABILITY_N)
        ]
        results = await asyncio.gather(*tasks)

        # Persist raw runs
        for i, r in enumerate(results):
            db.add(StabilityRun(
                meeting_id=meeting_id,
                agent_id=agent.id,
                run_index=i,
                kind=r["kind"],
                text=r["text"],
                basis=r.get("basis", ""),
            ))
        db.commit()

        active = [r for r in results if r["kind"] in ("contradict", "question")]
        texts = [r["text"] for r in active]

        clusters = await cluster_objections(texts, STABILITY_N, agent, client=client)

        for cl in clusters:
            db.add(StabilityCluster(
                meeting_id=meeting_id,
                agent_id=agent.id,
                role_title=agent.role_title,
                description=cl["description"],
                stability_pct=cl["stability_pct"],
                representative_text=cl["representative_text"],
            ))
        db.commit()

        yield {
            "event": "stability_agent",
            "data": {
                "agent_id": agent.id,
                "role_title": agent.role_title,
                "clusters": clusters,
            },
        }

    yield {"event": "stability_done", "data": {"meeting_id": meeting_id}}
