#!/usr/bin/env python3
"""
SmartRecover — Workspace recovery for when things crash.

Snapshots your terminals, tmux sessions, browser tabs, clipboard, shell
history and running apps on a schedule. When something hangs, freezes or
reboots, scrub back through the timeline in a TUI and pick up exactly
where you left off.

Zero dependencies. Pure Python stdlib.

Usage:
  smartrecover                       launch interactive timeline TUI
  smartrecover save [name]           take a manual snapshot (optionally named)
  smartrecover list                  list all snapshots
  smartrecover show <id>             show full details of a snapshot
  smartrecover restore <id>          interactively restore from a snapshot
  smartrecover search <text>         grep across all captured terminal/clipboard text
  smartrecover daemon [--interval N] run the autosaver (default every 600s)
  smartrecover prune --keep N        keep newest N snapshots, delete the rest
  smartrecover where                 print the database path

Designed for Linux (X11/Wayland). Gracefully degrades when optional helpers
(tmux, wmctrl, xclip, xsel, wl-paste) are missing.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

try:
    import fcntl
    HAVE_FCNTL = True
except ImportError:
    HAVE_FCNTL = False

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

APP = "smartrecover"
DATA_DIR = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / APP
SNAPSHOTS_FILE = DATA_DIR / "snapshots.jsonl"
LOCK_PATH = DATA_DIR / "daemon.lock"

CAPTURE_KINDS = ("processes", "tmux", "windows", "browser", "clipboard", "history")

# ---------------------------------------------------------------------------
# Terminal output (mirrors JumpDir style — render to /dev/tty so stdout
# remains usable for piping)
# ---------------------------------------------------------------------------

def _open_tty():
    try:
        if sys.platform == "win32":
            return open("CONOUT$", "w", buffering=1, encoding="utf-8", errors="replace")
        return open("/dev/tty", "w", buffering=1)
    except OSError:
        return sys.stderr

_tty = _open_tty()

def tprint(*a, **kw):
    kw.setdefault("file", _tty)
    print(*a, **kw)

# ANSI helpers
def _supports_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    return hasattr(_tty, "isatty") and _tty.isatty()

C = _supports_color()
def c(code: str, s: str) -> str:
    return f"\x1b[{code}m{s}\x1b[0m" if C else s

DIM = lambda s: c("2", s)
BOLD = lambda s: c("1", s)
CYAN = lambda s: c("36", s)
GREEN = lambda s: c("32", s)
YELLOW = lambda s: c("33", s)
RED = lambda s: c("31", s)
MAGENTA = lambda s: c("35", s)
BLUE = lambda s: c("34", s)

# ---------------------------------------------------------------------------
# Raw keypress (Linux/macOS) — used by TUI
# ---------------------------------------------------------------------------

if sys.platform != "win32":
    import termios
    import tty as _tty_mod

    def _getch():
        fd = _tty.fileno()
        old = termios.tcgetattr(fd)
        try:
            _tty_mod.setraw(fd)
            ch = os.read(fd, 1).decode("utf-8", errors="replace")
            if ch == "\x1b":
                # arrow / escape sequence
                ch2 = os.read(fd, 1).decode("utf-8", errors="replace")
                if ch2 == "[":
                    ch3 = os.read(fd, 1).decode("utf-8", errors="replace")
                    return {"A": "UP", "B": "DOWN", "C": "RIGHT", "D": "LEFT"}.get(ch3, None)
                return "ESC"
            if ch in ("\r", "\n"): return "ENTER"
            if ch in ("\x7f", "\x08"): return "BACKSPACE"
            return ch
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)
else:
    import msvcrt
    def _getch():
        ch = msvcrt.getwch()
        if ch in ("\x00", "\xe0"):
            ch2 = msvcrt.getwch()
            return {"H": "UP", "P": "DOWN", "K": "LEFT", "M": "RIGHT"}.get(ch2)
        if ch == "\r": return "ENTER"
        if ch == "\x1b": return "ESC"
        if ch in ("\x08", "\x7f"): return "BACKSPACE"
        return ch

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

# Storage is a single append-only JSONL file. One snapshot per line.
# An exclusive flock guards concurrent writes by the daemon and manual saves.

def _ensure_store() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SNAPSHOTS_FILE.exists():
        SNAPSHOTS_FILE.touch()

def _lock_ex(fh) -> None:
    if HAVE_FCNTL:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX)

def _unlock(fh) -> None:
    if HAVE_FCNTL:
        fcntl.flock(fh.fileno(), fcntl.LOCK_UN)

def _iter_snapshots():
    """Yield every snapshot dict in the store, in file order (oldest first)."""
    if not SNAPSHOTS_FILE.exists():
        return
    with open(SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue

def _rewrite(snapshots) -> None:
    """Atomically rewrite the store (used for delete / prune)."""
    _ensure_store()
    tmp = SNAPSHOTS_FILE.with_suffix(".jsonl.tmp")
    with open(SNAPSHOTS_FILE, "r+", encoding="utf-8") as lock_fh:
        _lock_ex(lock_fh)
        try:
            with open(tmp, "w", encoding="utf-8") as out:
                for snap in snapshots:
                    out.write(json.dumps(snap, ensure_ascii=False) + "\n")
            os.replace(tmp, SNAPSHOTS_FILE)
        finally:
            _unlock(lock_fh)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def which(cmd: str) -> str | None:
    return shutil.which(cmd)

def run(cmd: list[str], timeout: int = 4) -> str:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return out.stdout
    except (subprocess.SubprocessError, OSError, FileNotFoundError):
        return ""

def fmt_ts(ts: int) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))

def fmt_ago(ts: int) -> str:
    delta = max(0, int(time.time()) - ts)
    if delta < 60: return f"{delta}s ago"
    if delta < 3600: return f"{delta // 60}m ago"
    if delta < 86400: return f"{delta // 3600}h ago"
    return f"{delta // 86400}d ago"

def hostname() -> str:
    try:
        import socket
        return socket.gethostname()
    except Exception:
        return "?"

# ---------------------------------------------------------------------------
# Capture: processes (Linux via /proc; fallback to `ps`)
# ---------------------------------------------------------------------------

def capture_processes() -> list[dict]:
    procs: list[dict] = []
    proc_root = Path("/proc")
    if proc_root.is_dir():
        for entry in proc_root.iterdir():
            if not entry.name.isdigit():
                continue
            pid = int(entry.name)
            try:
                comm = (entry / "comm").read_text().strip()
                cmdline = (entry / "cmdline").read_bytes().split(b"\x00")
                cmdline = [p.decode("utf-8", "replace") for p in cmdline if p]
                cwd = ""
                try:
                    cwd = os.readlink(entry / "cwd")
                except OSError:
                    pass
                # skip kernel threads and tiny one-shots
                if not cmdline:
                    continue
                procs.append({"pid": pid, "comm": comm, "cmdline": cmdline, "cwd": cwd})
            except (FileNotFoundError, PermissionError, OSError):
                continue
    else:
        # macOS / others: use ps
        out = run(["ps", "-eo", "pid,comm,args"], timeout=3)
        for line in out.splitlines()[1:]:
            parts = line.strip().split(None, 2)
            if len(parts) < 3:
                continue
            pid_s, comm, args = parts
            try:
                procs.append({"pid": int(pid_s), "comm": comm, "cmdline": args.split(), "cwd": ""})
            except ValueError:
                continue
    # keep only user-facing names — filter the noise
    interesting = {
        "code", "code-insiders", "cursor", "firefox", "chrome", "chromium",
        "brave", "slack", "discord", "telegram", "spotify", "obsidian",
        "gnome-terminal", "konsole", "alacritty", "kitty", "wezterm",
        "tmux", "vim", "nvim", "emacs", "subl", "atom", "gedit", "kate",
        "thunderbird", "zoom", "teams", "vlc",
    }
    filtered = [p for p in procs if any(k in p["comm"].lower() for k in interesting)]
    return filtered or procs[:50]  # if filter wiped everything, keep first 50

# ---------------------------------------------------------------------------
# Capture: tmux
# ---------------------------------------------------------------------------

def capture_tmux() -> dict:
    if not which("tmux"):
        return {"available": False}
    sessions_raw = run(["tmux", "list-sessions", "-F",
                        "#{session_name}|#{session_windows}|#{session_created}"])
    if not sessions_raw.strip():
        return {"available": True, "sessions": []}
    sessions = []
    for line in sessions_raw.strip().splitlines():
        parts = line.split("|")
        if len(parts) < 2:
            continue
        name = parts[0]
        windows_raw = run(["tmux", "list-windows", "-t", name, "-F",
                          "#{window_index}|#{window_name}|#{window_layout}"])
        windows = []
        for wline in windows_raw.strip().splitlines():
            wparts = wline.split("|")
            if len(wparts) < 2: continue
            widx, wname = wparts[0], wparts[1]
            wlayout = wparts[2] if len(wparts) > 2 else ""
            panes_raw = run(["tmux", "list-panes", "-t", f"{name}:{widx}", "-F",
                            "#{pane_index}|#{pane_current_path}|#{pane_current_command}"])
            panes = []
            for pline in panes_raw.strip().splitlines():
                pparts = pline.split("|", 2)
                if len(pparts) < 3: continue
                pidx, cwd, cmd = pparts
                # capture scrollback
                scrollback = run(["tmux", "capture-pane", "-p", "-S", "-200",
                                  "-t", f"{name}:{widx}.{pidx}"], timeout=2)
                panes.append({
                    "index": pidx,
                    "cwd": cwd,
                    "cmd": cmd,
                    "scrollback": scrollback[-8000:],  # cap size
                })
            windows.append({"index": widx, "name": wname, "layout": wlayout, "panes": panes})
        sessions.append({"name": name, "windows": windows})
    return {"available": True, "sessions": sessions}

# ---------------------------------------------------------------------------
# Capture: windows (X11)
# ---------------------------------------------------------------------------

def capture_windows() -> dict:
    if which("wmctrl"):
        out = run(["wmctrl", "-lG"])
        windows = []
        for line in out.splitlines():
            parts = line.split(None, 7)
            if len(parts) < 8: continue
            wid, desktop, x, y, w, h, host, title = parts
            windows.append({
                "id": wid, "desktop": desktop,
                "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                "title": title,
            })
        return {"backend": "wmctrl", "windows": windows}
    return {"backend": None, "windows": []}

# ---------------------------------------------------------------------------
# Capture: browser tabs (Firefox + Chromium-family)
# ---------------------------------------------------------------------------

def _firefox_tabs() -> list[dict]:
    """Extract tabs from Firefox sessionstore. Handles .jsonlz4 if possible."""
    home = Path.home()
    candidates = [
        home / ".mozilla" / "firefox",
        home / "snap" / "firefox" / "common" / ".mozilla" / "firefox",
        home / ".var" / "app" / "org.mozilla.firefox" / ".mozilla" / "firefox",
    ]
    tabs = []
    for root in candidates:
        if not root.is_dir():
            continue
        for profile in root.iterdir():
            sstore = profile / "sessionstore-backups" / "recovery.jsonlz4"
            sstore_plain = profile / "sessionstore.js"
            data = None
            if sstore_plain.exists():
                try:
                    data = json.loads(sstore_plain.read_text(errors="replace"))
                except Exception:
                    pass
            elif sstore.exists():
                # mozlz4 header: b"mozLz40\x00" + lz4 block
                try:
                    raw = sstore.read_bytes()
                    if raw[:8] == b"mozLz40\x00":
                        # Try to decompress via system lz4 binary (stdlib has no lz4)
                        if which("lz4jsoncat"):
                            data = json.loads(run(["lz4jsoncat", str(sstore)]))
                        # else: skip silently; we still get URLs from history file later
                except Exception:
                    pass
            if not data:
                continue
            for win in data.get("windows", []):
                for tab in win.get("tabs", []):
                    entries = tab.get("entries", [])
                    if not entries: continue
                    cur = entries[tab.get("index", len(entries)) - 1]
                    tabs.append({
                        "browser": "firefox",
                        "profile": profile.name,
                        "url": cur.get("url", ""),
                        "title": cur.get("title", ""),
                    })
    return tabs

def _chromium_tabs() -> list[dict]:
    """Best-effort: copy Session file path so user can restore via browser."""
    home = Path.home()
    roots = {
        "chrome": home / ".config" / "google-chrome",
        "chromium": home / ".config" / "chromium",
        "brave": home / ".config" / "BraveSoftware" / "Brave-Browser",
        "edge": home / ".config" / "microsoft-edge",
    }
    found = []
    for name, root in roots.items():
        if not root.is_dir():
            continue
        for profile in root.iterdir():
            sess_dir = profile / "Sessions"
            if sess_dir.is_dir():
                sessions = sorted(sess_dir.glob("Session_*"), reverse=True)
                if sessions:
                    found.append({
                        "browser": name,
                        "profile": profile.name,
                        "session_file": str(sessions[0]),
                    })
    return found

def capture_browser() -> dict:
    return {
        "firefox_tabs": _firefox_tabs(),
        "chromium_sessions": _chromium_tabs(),
    }

# ---------------------------------------------------------------------------
# Capture: clipboard
# ---------------------------------------------------------------------------

def capture_clipboard() -> dict:
    for cmd in (["wl-paste", "--no-newline"], ["xclip", "-o", "-selection", "clipboard"], ["xsel", "-b"]):
        if which(cmd[0]):
            text = run(cmd, timeout=2)
            if text:
                return {"backend": cmd[0], "text": text[:20000]}
    return {"backend": None, "text": ""}

# ---------------------------------------------------------------------------
# Capture: shell history
# ---------------------------------------------------------------------------

def capture_history() -> dict:
    home = Path.home()
    files = {
        "bash": home / ".bash_history",
        "zsh": home / ".zsh_history",
        "fish": home / ".local" / "share" / "fish" / "fish_history",
    }
    out: dict[str, list[str]] = {}
    for name, path in files.items():
        if path.exists():
            try:
                lines = path.read_text(errors="replace").splitlines()
                out[name] = lines[-200:]  # last 200 commands
            except OSError:
                pass
    return out

# ---------------------------------------------------------------------------
# Snapshot orchestration
# ---------------------------------------------------------------------------

CAPTURERS = {
    "processes": capture_processes,
    "tmux":      capture_tmux,
    "windows":   capture_windows,
    "browser":   capture_browser,
    "clipboard": capture_clipboard,
    "history":   capture_history,
}

def take_snapshot(name: str | None = None, kind: str = "manual", note: str = "") -> int:
    _ensure_store()
    # Capture first, then write under lock — keeps the critical section short.
    captures: dict[str, Any] = {}
    for ckind, fn in CAPTURERS.items():
        try:
            captures[ckind] = fn()
        except Exception as e:
            captures[ckind] = {"error": f"{type(e).__name__}: {e}"}

    with open(SNAPSHOTS_FILE, "r+", encoding="utf-8") as f:
        _lock_ex(f)
        try:
            # Determine next id by scanning current file (under the lock).
            max_id = 0
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if obj.get("id", 0) > max_id:
                        max_id = obj["id"]
                except json.JSONDecodeError:
                    continue
            sid = max_id + 1
            snap = {
                "id": sid,
                "ts": int(time.time()),
                "name": name,
                "kind": kind,
                "host": hostname(),
                "note": note,
                "captures": captures,
            }
            f.seek(0, os.SEEK_END)
            f.write(json.dumps(snap, ensure_ascii=False) + "\n")
            f.flush()
            os.fsync(f.fileno())
            return sid
        finally:
            _unlock(f)

def load_snapshot(snap_id: int) -> dict | None:
    for snap in _iter_snapshots():
        if snap.get("id") == snap_id:
            snap.setdefault("captures", {})
            return snap
    return None

def list_snapshots(limit: int = 200) -> list[dict]:
    snaps = []
    for snap in _iter_snapshots():
        snaps.append({
            "id": snap.get("id"),
            "ts": snap.get("ts", 0),
            "name": snap.get("name"),
            "kind": snap.get("kind", "auto"),
            "host": snap.get("host"),
        })
    snaps.sort(key=lambda s: (s["ts"], s["id"] or 0), reverse=True)
    return snaps[:limit]

def delete_snapshots(ids) -> int:
    """Delete snapshots whose id is in `ids`. Returns the count removed."""
    ids = set(ids)
    if not ids:
        return 0
    kept = []
    removed = 0
    for snap in _iter_snapshots():
        if snap.get("id") in ids:
            removed += 1
        else:
            kept.append(snap)
    if removed:
        _rewrite(kept)
    return removed

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------

def restore_tmux(snap: dict, confirm=True) -> int:
    tmux_data = snap["captures"].get("tmux") or {}
    sessions = tmux_data.get("sessions", [])
    if not sessions:
        tprint(DIM("  no tmux sessions to restore"))
        return 0
    if not which("tmux"):
        tprint(RED("  tmux not installed"))
        return 0
    restored = 0
    for sess in sessions:
        sname = f"sr-{sess['name']}-{int(time.time()) % 10000}"
        windows = sess.get("windows", [])
        if not windows:
            continue
        first_pane = windows[0]["panes"][0] if windows[0].get("panes") else None
        cwd = first_pane["cwd"] if first_pane else str(Path.home())
        subprocess.run(["tmux", "new-session", "-d", "-s", sname, "-c", cwd])
        for w_i, win in enumerate(windows):
            for p_i, pane in enumerate(win.get("panes", [])):
                target = f"{sname}:{w_i}.{p_i}"
                if w_i == 0 and p_i == 0:
                    pass  # already created with first cwd
                elif p_i == 0:
                    subprocess.run(["tmux", "new-window", "-t", f"{sname}:{w_i}",
                                    "-c", pane["cwd"], "-n", win.get("name", "")])
                else:
                    subprocess.run(["tmux", "split-window", "-t", f"{sname}:{w_i}",
                                    "-c", pane["cwd"]])
        tprint(GREEN(f"  ✓ restored tmux session: {sname}"))
        restored += 1
    tprint(DIM(f"  attach with: tmux attach -t <name>"))
    return restored

def restore_browser(snap: dict) -> int:
    b = snap["captures"].get("browser") or {}
    tabs = b.get("firefox_tabs", [])
    if not tabs and not b.get("chromium_sessions"):
        tprint(DIM("  no browser tabs captured"))
        return 0
    out_path = DATA_DIR / f"restore-tabs-{snap['id']}.html"
    parts = ["<!doctype html><meta charset=utf-8>",
             f"<title>SmartRecover — snapshot {snap['id']}</title>",
             "<style>body{font:14px system-ui;max-width:800px;margin:2em auto;padding:0 1em}",
             "h2{border-bottom:1px solid #ccc;padding-bottom:.3em}",
             "li{margin:.3em 0}</style>",
             f"<h1>Restore tabs from {fmt_ts(snap['ts'])}</h1>"]
    if tabs:
        parts.append(f"<h2>Firefox ({len(tabs)} tabs)</h2><ul>")
        for t in tabs:
            url = t.get("url", "")
            title = t.get("title", "") or url
            parts.append(f'<li><a href="{url}" target="_blank">{title}</a></li>')
        parts.append("</ul>")
    for cs in b.get("chromium_sessions", []):
        parts.append(f"<h2>{cs['browser']} — profile {cs['profile']}</h2>")
        parts.append(f"<p>Chromium binary tab data: <code>{cs['session_file']}</code></p>")
    out_path.write_text("\n".join(parts))
    tprint(GREEN(f"  ✓ wrote {out_path}"))
    if which("xdg-open"):
        subprocess.Popen(["xdg-open", str(out_path)],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return len(tabs)

def restore_clipboard(snap: dict) -> bool:
    cb = snap["captures"].get("clipboard") or {}
    text = cb.get("text", "")
    if not text:
        tprint(DIM("  no clipboard captured"))
        return False
    for cmd in (["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "-b", "-i"]):
        if which(cmd[0]):
            try:
                p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
                p.communicate(text.encode("utf-8"))
                tprint(GREEN(f"  ✓ clipboard restored ({len(text)} chars via {cmd[0]})"))
                return True
            except OSError:
                continue
    tprint(YELLOW("  no clipboard tool found — text saved to:"))
    out = DATA_DIR / f"clipboard-{snap['id']}.txt"
    out.write_text(text)
    tprint(f"    {out}")
    return False

# ---------------------------------------------------------------------------
# Pretty printers
# ---------------------------------------------------------------------------

def render_summary(snap: dict) -> list[str]:
    caps = snap["captures"]
    lines = []
    name = snap["name"] or DIM("(unnamed)")
    badge = MAGENTA(f"[{snap['kind']}]")
    lines.append(f"{BOLD('Snapshot #' + str(snap['id']))}  {badge}  {name}")
    lines.append(DIM(f"  {fmt_ts(snap['ts'])}  ·  {fmt_ago(snap['ts'])}  ·  {snap['host']}"))
    lines.append("")

    procs = caps.get("processes") or []
    if procs:
        lines.append(BOLD(f"Processes ({len(procs)})"))
        for p in procs[:12]:
            tag = CYAN(p["comm"])
            cwd = DIM(f" · {p['cwd']}") if p.get("cwd") else ""
            lines.append(f"  ▸ {tag}{cwd}")
        if len(procs) > 12:
            lines.append(DIM(f"  ... and {len(procs) - 12} more"))
        lines.append("")

    tmux = caps.get("tmux") or {}
    sessions = tmux.get("sessions", [])
    if sessions:
        total_panes = sum(len(p.get("panes", [])) for s in sessions for p in s.get("windows", []))
        lines.append(BOLD(f"tmux ({len(sessions)} session(s), {total_panes} pane(s))"))
        for sess in sessions:
            lines.append(f"  ▸ {GREEN(sess['name'])}")
            for win in sess.get("windows", []):
                for pane in win.get("panes", []):
                    cmd = pane.get("cmd", "")
                    cwd = pane.get("cwd", "")
                    lines.append(f"     · {cwd}  {DIM('[' + cmd + ']')}")
        lines.append("")

    windows = (caps.get("windows") or {}).get("windows", [])
    if windows:
        lines.append(BOLD(f"Windows ({len(windows)})"))
        for w in windows[:10]:
            lines.append(f"  ▸ {w['title']}")
        if len(windows) > 10:
            lines.append(DIM(f"  ... and {len(windows) - 10} more"))
        lines.append("")

    browser = caps.get("browser") or {}
    ff = browser.get("firefox_tabs", [])
    cs = browser.get("chromium_sessions", [])
    if ff or cs:
        lines.append(BOLD(f"Browser ({len(ff)} Firefox tab(s), {len(cs)} Chromium profile(s))"))
        for t in ff[:8]:
            title = t.get("title") or t.get("url", "")
            lines.append(f"  ▸ {title[:90]}")
        if len(ff) > 8:
            lines.append(DIM(f"  ... and {len(ff) - 8} more tabs"))
        for c_ in cs:
            lines.append(f"  ▸ {c_['browser']} · profile {c_['profile']}  {DIM('(binary session)')}")
        lines.append("")

    clip = caps.get("clipboard") or {}
    if clip.get("text"):
        preview = clip["text"].replace("\n", " ↵ ")[:140]
        lines.append(BOLD("Clipboard"))
        lines.append(f"  {preview}{'...' if len(clip['text']) > 140 else ''}")
        lines.append("")

    hist = caps.get("history") or {}
    if hist:
        total = sum(len(v) for v in hist.values())
        lines.append(BOLD(f"Shell history ({total} command(s) across {len(hist)} shell(s))"))
        for shell, cmds in hist.items():
            if cmds:
                lines.append(f"  {YELLOW(shell)}: {DIM(cmds[-1][:90])}")
        lines.append("")

    return lines

# ---------------------------------------------------------------------------
# TUI — timeline browser
# ---------------------------------------------------------------------------

def _term_size():
    try:
        return shutil.get_terminal_size()
    except Exception:
        return os.terminal_size((100, 30))

def _clear():
    tprint("\x1b[2J\x1b[H", end="")

def tui():
    snaps = list_snapshots(500)
    if not snaps:
        tprint(YELLOW("No snapshots yet. Run `smartrecover save` or `smartrecover daemon` first."))
        return

    sel = 0
    scroll = 0
    msg = ""
    detail_cache: dict[int, list[str]] = {}

    while True:
        size = _term_size()
        cols, rows = size.columns, size.lines
        left_w = max(28, cols // 3)
        right_w = cols - left_w - 3

        _clear()
        title = f" SmartRecover — Pick up where you left off   {DIM(str(len(snaps)) + ' snapshots')} "
        tprint(BOLD(title))
        tprint("─" * cols)

        visible = rows - 6
        if sel < scroll: scroll = sel
        if sel >= scroll + visible: scroll = sel - visible + 1

        # Render the two-column body
        snap = snaps[sel]
        if snap["id"] not in detail_cache:
            full = load_snapshot(snap["id"])
            detail_cache[snap["id"]] = render_summary(full) if full else ["(missing)"]
        detail_lines = detail_cache[snap["id"]]

        for i in range(visible):
            idx = scroll + i
            # left
            if idx < len(snaps):
                s = snaps[idx]
                marker = "●" if s["kind"] == "manual" else "○"
                marker_c = MAGENTA(marker) if s["kind"] == "manual" else DIM(marker)
                name = s["name"] or DIM("auto")
                tstr = time.strftime("%m-%d %H:%M", time.localtime(s["ts"]))
                row = f" {marker_c} {tstr}  {name}"
                if idx == sel:
                    row = c("7", row.ljust(left_w))  # reverse video
                else:
                    row = row.ljust(left_w + 20)  # account for ANSI in name
                left = row[:left_w + 30]
            else:
                left = "".ljust(left_w)
            # right
            right = detail_lines[i] if i < len(detail_lines) else ""
            tprint(f"{left} {DIM('│')} {right}")

        tprint("─" * cols)
        keys = "↑↓ navigate · [s]ave · [r]estore · [t]mux · [b]rowser · [c]lipboard · [/]search · [d]elete · [q]uit"
        tprint(DIM(keys))
        if msg:
            tprint(msg)
            msg = ""

        key = _getch()
        if key in ("q", "ESC"): break
        elif key == "UP" or key == "k":
            if sel > 0: sel -= 1
        elif key == "DOWN" or key == "j":
            if sel < len(snaps) - 1: sel += 1
        elif key == "g":
            sel = 0
        elif key == "G":
            sel = len(snaps) - 1
        elif key == "s":
            _clear()
            tprint(BOLD("Take new snapshot"))
            tprint("Name (optional, ENTER for none): ", end="")
            _tty.flush()
            name = _readline()
            tprint(DIM("Capturing..."))
            sid = take_snapshot(name or None, kind="manual")
            snaps = list_snapshots(500)
            sel = 0
            msg = GREEN(f"✓ saved snapshot #{sid}")
        elif key in ("r", "t", "b", "c"):
            full = load_snapshot(snap["id"])
            if not full: continue
            _clear()
            tprint(BOLD(f"Restoring from snapshot #{full['id']}"))
            tprint("")
            if key in ("r", "t"):
                restore_tmux(full)
            if key in ("r", "b"):
                restore_browser(full)
            if key in ("r", "c"):
                restore_clipboard(full)
            tprint("")
            tprint(DIM("Press any key to continue..."))
            _getch()
        elif key == "d":
            _clear()
            tprint(YELLOW(f"Delete snapshot #{snap['id']}? [y/N] "), end="")
            _tty.flush()
            if _getch() in ("y", "Y"):
                delete_snapshots([snap["id"]])
                snaps = list_snapshots(500)
                if sel >= len(snaps): sel = max(0, len(snaps) - 1)
                msg = RED(f"deleted #{snap['id']}")
        elif key == "/":
            _clear()
            tprint(BOLD("Search across all snapshots"))
            tprint("Query: ", end="")
            _tty.flush()
            q = _readline()
            if q:
                _clear()
                cmd_search(q)
                tprint("")
                tprint(DIM("Press any key to continue..."))
                _getch()

    _clear()

def _readline() -> str:
    """Read a line from /dev/tty in cooked mode."""
    if sys.platform == "win32":
        return input()
    fd = _tty.fileno()
    old = termios.tcgetattr(fd)
    try:
        termios.tcsetattr(fd, termios.TCSADRAIN, old)  # ensure cooked
        line = sys.stdin.readline()
        return line.rstrip("\n")
    except Exception:
        return ""

# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def cmd_save(args):
    sid = take_snapshot(args.name, kind="manual", note=args.note or "")
    snap = load_snapshot(sid)
    if not snap:
        tprint(RED("save failed"))
        return 1
    counts = {k: len(v) if isinstance(v, list) else (
              len((v or {}).get("sessions", [])) if k == "tmux" else
              len((v or {}).get("windows", [])) if k == "windows" else
              len((v or {}).get("firefox_tabs", [])) if k == "browser" else
              ("yes" if (v or {}).get("text") else "no") if k == "clipboard" else "?")
              for k, v in snap["captures"].items()}
    tprint(GREEN(f"✓ snapshot #{sid} saved"))
    tprint(DIM(f"  procs={counts.get('processes', 0)}  "
               f"tmux={counts.get('tmux', 0)}  "
               f"windows={counts.get('windows', 0)}  "
               f"browser_tabs={counts.get('browser', 0)}  "
               f"clipboard={counts.get('clipboard', 'no')}"))
    return 0

def cmd_list(args):
    snaps = list_snapshots(args.limit)
    if not snaps:
        tprint(DIM("(no snapshots)"))
        return 0
    for s in snaps:
        marker = MAGENTA("●") if s["kind"] == "manual" else DIM("○")
        name = s["name"] or DIM("—")
        tprint(f"  {marker} #{s['id']:<4} {fmt_ts(s['ts'])}  {DIM(fmt_ago(s['ts']).rjust(8))}  {name}")
    return 0

def cmd_show(args):
    snap = load_snapshot(args.id)
    if not snap:
        tprint(RED(f"snapshot #{args.id} not found"))
        return 1
    for line in render_summary(snap):
        tprint(line)
    return 0

def cmd_restore(args):
    snap = load_snapshot(args.id)
    if not snap:
        tprint(RED(f"snapshot #{args.id} not found"))
        return 1
    tprint(BOLD(f"Restoring from #{snap['id']}  ({fmt_ts(snap['ts'])})"))
    tprint("")
    do_all = not (args.tmux or args.browser or args.clipboard)
    if do_all or args.tmux:
        tprint(BOLD("tmux:"))
        restore_tmux(snap)
        tprint("")
    if do_all or args.browser:
        tprint(BOLD("browser:"))
        restore_browser(snap)
        tprint("")
    if do_all or args.clipboard:
        tprint(BOLD("clipboard:"))
        restore_clipboard(snap)
    return 0

def cmd_search(query_or_args):
    q = query_or_args if isinstance(query_or_args, str) else query_or_args.query
    q_low = q.lower()
    # Build a flat list of (snap_id, ts, capture_kind, json_blob) ordered newest first.
    rows = []
    for snap in _iter_snapshots():
        sid = snap.get("id")
        ts = snap.get("ts", 0)
        for ck, payload in (snap.get("captures") or {}).items():
            rows.append((sid, ts, snap.get("name"), ck,
                         json.dumps(payload, ensure_ascii=False)))
    rows.sort(key=lambda r: r[1], reverse=True)
    hits = 0
    for sid, ts, name, kind, data in rows:
        low = data.lower()
        pos = low.find(q_low)
        if pos < 0:
            continue
        start = max(0, pos - 40)
        end = min(len(data), pos + len(q) + 80)
        snippet = data[start:end].replace("\n", " ").replace("\\n", " ")
        prefix = "…" if start > 0 else ""
        suffix = "…" if end < len(data) else ""
        tprint(f"{MAGENTA('#' + str(sid))} {DIM(fmt_ts(ts))} {CYAN(kind):>10}: {prefix}{snippet}{suffix}")
        hits += 1
    if not hits:
        tprint(DIM(f"no matches for '{q}'"))
    else:
        tprint("")
        tprint(DIM(f"{hits} hit(s)"))
    return 0

def cmd_prune(args):
    snaps = list_snapshots(10000)
    if len(snaps) <= args.keep:
        tprint(DIM(f"only {len(snaps)} snapshots, nothing to prune"))
        return 0
    to_delete = snaps[args.keep:]
    removed = delete_snapshots(s["id"] for s in to_delete)
    tprint(GREEN(f"✓ pruned {removed} snapshots, kept {args.keep}"))
    return 0

def cmd_where(args):
    tprint(str(SNAPSHOTS_FILE))
    return 0

def cmd_daemon(args):
    interval = args.interval
    if LOCK_PATH.exists():
        try:
            pid = int(LOCK_PATH.read_text())
            os.kill(pid, 0)
            tprint(RED(f"daemon already running (pid {pid})"))
            tprint(DIM(f"  remove {LOCK_PATH} if stale"))
            return 1
        except (OSError, ValueError):
            LOCK_PATH.unlink(missing_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOCK_PATH.write_text(str(os.getpid()))

    stopping = {"flag": False}
    def _stop(signum, frame):
        stopping["flag"] = True
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    tprint(GREEN(f"smartrecover daemon started (pid {os.getpid()}, interval {interval}s)"))
    try:
        # take one immediately
        sid = take_snapshot(None, kind="auto")
        tprint(DIM(f"  · #{sid} captured at {fmt_ts(int(time.time()))}"))
        next_tick = time.time() + interval
        while not stopping["flag"]:
            time.sleep(0.5)
            if time.time() >= next_tick:
                try:
                    sid = take_snapshot(None, kind="auto")
                    tprint(DIM(f"  · #{sid} captured at {fmt_ts(int(time.time()))}"))
                except Exception as e:
                    tprint(RED(f"  capture error: {e}"))
                next_tick = time.time() + interval
        # final snapshot on graceful shutdown
        try:
            sid = take_snapshot("shutdown", kind="manual", note="captured on daemon stop")
            tprint(YELLOW(f"  · shutdown snapshot #{sid}"))
        except Exception:
            pass
    finally:
        LOCK_PATH.unlink(missing_ok=True)
        tprint(GREEN("smartrecover daemon stopped."))
    return 0

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="smartrecover",
                                description="Smart recovery for your workspace — when things crash, pick up where you left off.")
    sub = p.add_subparsers(dest="cmd")

    sp = sub.add_parser("save", help="take a manual snapshot")
    sp.add_argument("name", nargs="?", help="optional snapshot name")
    sp.add_argument("--note", default="", help="long-form note")
    sp.set_defaults(func=cmd_save)

    sp = sub.add_parser("list", help="list snapshots")
    sp.add_argument("--limit", type=int, default=50)
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("show", help="show snapshot details")
    sp.add_argument("id", type=int)
    sp.set_defaults(func=cmd_show)

    sp = sub.add_parser("restore", help="restore parts of a snapshot")
    sp.add_argument("id", type=int)
    sp.add_argument("--tmux", action="store_true")
    sp.add_argument("--browser", action="store_true")
    sp.add_argument("--clipboard", action="store_true")
    sp.set_defaults(func=cmd_restore)

    sp = sub.add_parser("search", help="grep across all snapshots")
    sp.add_argument("query")
    sp.set_defaults(func=cmd_search)

    sp = sub.add_parser("daemon", help="run autosave daemon")
    sp.add_argument("--interval", type=int, default=600, help="seconds between auto snapshots")
    sp.set_defaults(func=cmd_daemon)

    sp = sub.add_parser("prune", help="delete old snapshots")
    sp.add_argument("--keep", type=int, default=50)
    sp.set_defaults(func=cmd_prune)

    sp = sub.add_parser("where", help="print db location")
    sp.set_defaults(func=cmd_where)

    return p

def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.cmd:
        try:
            tui()
        except KeyboardInterrupt:
            _clear()
        return 0
    return args.func(args) or 0

if __name__ == "__main__":
    sys.exit(main())
