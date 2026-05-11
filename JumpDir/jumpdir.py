#!/usr/bin/env python3
"""
JumpDir Advanced - Interactive fuzzy directory navigator.

Usage:
  j            search from current directory
  j -d proj    search entire D: drive for 'proj'
  j -c proj    search entire C: drive for 'proj'
  j -g proj    search all drives (global)
  j proj       search from current directory for 'proj'

Windows CMD:  python jumpdir.py --make-bat   (one-time, creates j.bat)
bash setup:   echo 'eval "$(python3 jumpdir.py --init)"'     >> ~/.bashrc
zsh  setup:   echo 'eval "$(python3 jumpdir.py --init-zsh)"' >> ~/.zshrc
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Terminal device — TUI always renders here; stdout stays clean for capture
# ---------------------------------------------------------------------------

def _open_tty():
    try:
        if sys.platform == "win32":
            return open("CONOUT$", "w", buffering=1, encoding="utf-8", errors="replace")
        return open("/dev/tty", "w", buffering=1)
    except OSError:
        return sys.stderr

_tty = _open_tty()


# ---------------------------------------------------------------------------
# Cross-platform raw keypress
# ---------------------------------------------------------------------------

if sys.platform == "win32":
    import msvcrt
    import ctypes

    def _enable_ansi():
        try:
            win_handle = msvcrt.get_osfhandle(_tty.fileno())
            mode = ctypes.c_ulong()
            ctypes.windll.kernel32.GetConsoleMode(win_handle, ctypes.byref(mode))
            ctypes.windll.kernel32.SetConsoleMode(win_handle, mode.value | 0x0004)
        except Exception:
            pass

    def _get_drives():
        import string
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()
        drives = []
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                drives.append(f"{letter}:\\")
            bitmask >>= 1
        return drives

    def _getch():
        ch = msvcrt.getwch()
        if ch in ('\x00', '\xe0'):
            ch2 = msvcrt.getwch()
            if ch2 == 'H': return 'UP'
            if ch2 == 'P': return 'DOWN'
            if ch2 == 'S': return 'DEL'
            return None
        if ch == '\r':             return 'ENTER'
        if ch == '\x1b':           return 'ESC'
        if ch in ('\x08', '\x7f'): return 'BACKSPACE'
        return ch

else:
    import termios, tty as _tty_mod

    def _enable_ansi():
        pass

    def _get_drives():
        return ["/"]

    def _getch():
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            _tty_mod.setraw(fd)
            ch = sys.stdin.read(1)
            if ch == '\x1b':
                nxt = sys.stdin.read(1)
                if nxt == '[':
                    code = sys.stdin.read(1)
                    if code == 'A': return 'UP'
                    if code == 'B': return 'DOWN'
                    if code == '3': sys.stdin.read(1); return 'DEL'
                return 'ESC'
            if ch in ('\r', '\n'):         return 'ENTER'
            if ch in ('\x7f', '\x08'):     return 'BACKSPACE'
            return ch
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

DB_PATH = Path.home() / ".jumpdir_db.json"

def load_db() -> dict:
    if DB_PATH.exists():
        try:
            return json.loads(DB_PATH.read_text())
        except Exception:
            return {}
    return {}

def save_db(db: dict) -> None:
    DB_PATH.write_text(json.dumps(db, indent=2))

def record_visit(path: str) -> None:
    path = str(Path(path).resolve())
    db = load_db()
    entry = db.get(path, {"visits": 0, "last": 0})
    entry["visits"] += 1
    entry["last"] = time.time()
    db[path] = entry
    save_db(db)


# ---------------------------------------------------------------------------
# Directory discovery
# ---------------------------------------------------------------------------

SKIP_DIRS = {
    "Windows", "System32", "SysWOW64", "WinSxS", "$Recycle.Bin",
    "ProgramData", "AppData", "Temp", "temp", "node_modules",
    ".git", "__pycache__", "venv", ".venv", "dist", "build",
    "proc", "sys", "dev", "run", "snap", "boot",
}

def _bfs(root: Path, max_depth: int) -> list:
    found = []
    queue = [(root, 0)]
    while queue:
        cur, depth = queue.pop(0)
        try:
            for child in sorted(cur.iterdir()):
                try:
                    if not child.is_dir():
                        continue
                    n = child.name
                    if n.startswith(".") or n in SKIP_DIRS:
                        continue
                    found.append(str(child))
                    if depth < max_depth:
                        queue.append((child, depth + 1))
                except (PermissionError, OSError):
                    continue
        except (PermissionError, OSError):
            continue
    return found

def _discover(scope: str = "local") -> tuple:
    """
    scope: 'local' | 'global' | drive letter e.g. 'D'
    Returns (dirs_list, scope_label)
    """
    seen: set = set()
    result = []

    def add(paths):
        for p in paths:
            if p not in seen:
                seen.add(p)
                result.append(p)

    cwd  = Path.cwd()
    home = Path.home()

    if scope == "local":
        add(_bfs(cwd,  max_depth=5))
        add(_bfs(Path(cwd.anchor), max_depth=4))
        add(_bfs(home, max_depth=4))
        label = f"Local  {cwd}"

    elif scope == "global":
        for drive in _get_drives():
            add(_bfs(Path(drive), max_depth=5))
        label = "Global (all drives)"

    else:
        # Specific drive letter
        drive_root = Path(f"{scope.upper()}:\\") if sys.platform == "win32" else Path("/")
        add(_bfs(drive_root, max_depth=5))
        label = f"Drive {scope.upper()}:\\"

    return result, label


# ---------------------------------------------------------------------------
# Fuzzy match + ranking
# ---------------------------------------------------------------------------

def fuzzy_match(query: str, text: str) -> tuple:
    if not query:
        return 1, []
    q, t = query.lower(), text.lower()
    idx = t.find(q)
    if idx != -1:
        return 800 + (100 if idx == 0 else 0) + len(q), list(range(idx, idx + len(q)))
    qi, matched, score, cons, prev = 0, [], 0, 0, -2
    for i, ch in enumerate(t):
        if qi < len(q) and ch == q[qi]:
            matched.append(i)
            cons = cons + 1 if i == prev + 1 else 1
            score += 10 * cons if i == prev + 1 else 1
            prev = i; qi += 1
    return (score, matched) if qi == len(q) else (0, [])

def rank(query: str, db: dict, dirs: list) -> list:
    now = time.time()
    seen: dict = {}

    for path, meta in db.items():
        if not Path(path).is_dir():
            continue
        name = Path(path).name
        sc, _ = fuzzy_match(query, name)
        if sc == 0:
            sc2, _ = fuzzy_match(query, path)
            sc = sc2 // 2
        if sc == 0:
            continue
        age = (now - meta.get("last", now)) / 86400
        seen[path] = int(sc + meta.get("visits", 1) * 3 + max(0.0, 20 - age * 2))

    for path in dirs:
        if path in seen:
            continue
        name = Path(path).name
        sc, _ = fuzzy_match(query, name)
        if sc == 0:
            sc2, _ = fuzzy_match(query, path)
            sc = sc2 // 2
        if sc == 0:
            continue
        seen[path] = sc

    results = list(seen.items())
    results.sort(key=lambda x: -x[1])
    return results


# ---------------------------------------------------------------------------
# TUI rendering
# ---------------------------------------------------------------------------

_W  = "\033[97m"   # bright white
_C  = "\033[36m"   # cyan
_Y  = "\033[33m"   # yellow  (matched chars)
_G  = "\033[32m"   # green
_DM = "\033[2m"    # dim
_BD = "\033[1m"    # bold
_RS = "\033[0m"    # reset

_BG_HEADER   = "\033[48;5;17m"    # dark blue bg
_BG_SELECTED = "\033[48;5;22m"    # dark green bg
_FG_BLACK    = "\033[30m"

def _hl(name: str, indices: list) -> str:
    idx = set(indices)
    return "".join(f"{_Y}{_BD}{ch}{_RS}" if i in idx else ch for i, ch in enumerate(name))

def _trunc(s: str, n: int) -> str:
    return s if len(s) <= n else "..." + s[-(n-3):]

_drawn = 0

def _render(query: str, results: list, selected: int, scope_label: str) -> None:
    global _drawn
    rows = []

    if _drawn > 0:
        rows.append(f"\033[{_drawn}A")

    n = len(results)
    count_str = f"{n} result{'s' if n != 1 else ''}"

    # ── Header ──────────────────────────────────────────────────────────────
    rows.append(
        f"\033[2K\r{_BG_HEADER}{_W}{_BD}"
        f"  JumpDir  "
        f"{_RS}{_BG_HEADER}\033[96m[ {scope_label} ]{_RS}{_BG_HEADER}{_DM}  "
        f"↑↓ navigate · Enter jump · Esc quit  "
        f"{_RS}{_BG_HEADER}\033[93m{count_str}  {_RS}"
    )

    # ── Prompt ───────────────────────────────────────────────────────────────
    rows.append(f"\033[2K\r  {_C}{_BD}❯{_RS}  {_W}{query}{_C}{_BD}▌{_RS}")

    # ── Separator ────────────────────────────────────────────────────────────
    rows.append(f"\033[2K\r  {_DM}{'─' * 68}{_RS}")

    # ── Results ──────────────────────────────────────────────────────────────
    if not results:
        rows.append(f"\033[2K\r  {_DM}  no matches — keep typing{_RS}")
    else:
        for i, (path, _) in enumerate(results[:15]):
            name = Path(path).name
            _, idx = fuzzy_match(query, name)
            name_col = 26
            path_col = 50
            name_pad = " " * max(0, name_col - len(name))
            disp_path = _trunc(path, path_col)

            if i == selected:
                rows.append(
                    f"\033[2K\r{_BG_SELECTED}  {_W}{_BD}▶  {name}{name_pad}{_RS}"
                    f"{_BG_SELECTED}  {_DM}{disp_path}{_RS}"
                )
            else:
                pointer = "   "
                rows.append(
                    f"\033[2K\r  {pointer}{_hl(name, idx)}{name_pad}  {_DM}{disp_path}{_RS}"
                )

    _drawn = len(rows)
    _tty.write("\n".join(rows))
    _tty.flush()


def _clear_tui() -> None:
    global _drawn
    if _drawn > 0:
        _tty.write(f"\033[{_drawn}A" + "\033[2K\r\n" * _drawn + f"\033[{_drawn}A")
    _tty.write("\033[?25h")
    _tty.flush()
    _drawn = 0


# ---------------------------------------------------------------------------
# Interactive picker
# ---------------------------------------------------------------------------

def _render_scope_picker() -> None:
    drives = _get_drives()
    drive_opts = "  ".join(
        f"{_BD}\033[93m[{d[0]}]{_RS} {d}"
        for d in drives
        if d[0].upper() not in ("C",)   # list all drives
    )
    rows = [
        f"\033[2K\r{_BG_HEADER}{_W}{_BD}  JumpDir  — Pick a search scope  {_RS}",
        f"\033[2K\r",
        f"\033[2K\r  {_C}{_BD}[L]{_RS}  Local   — current folder tree",
        f"\033[2K\r  {_C}{_BD}[C]{_RS}  C:\\     — entire C: drive",
    ]
    for d in drives:
        letter = d[0].upper()
        if letter == "C":
            continue
        rows.append(f"\033[2K\r  {_C}{_BD}[{letter}]{_RS}  {d}    — entire {letter}: drive")
    rows += [
        f"\033[2K\r  {_C}{_BD}[G]{_RS}  Global  — all drives",
        f"\033[2K\r",
        f"\033[2K\r  {_DM}Press a key...{_RS}",
    ]
    _tty.write("\n".join(rows))
    _tty.flush()
    return len(rows)


def pick_scope() -> str | None:
    """Show scope menu, return scope string or None on Esc."""
    global _drawn
    _drawn = 0
    _enable_ansi()
    _tty.write("\033[?25l")
    _tty.flush()
    try:
        n = _render_scope_picker()
        _drawn = n
        while True:
            key = _getch()
            if key is None:
                continue
            if key == 'ESC':
                return None
            if isinstance(key, str) and len(key) == 1:
                k = key.upper()
                if k == 'L': return "local"
                if k == 'G': return "global"
                # Any drive letter
                drives = [d[0].upper() for d in _get_drives()]
                if k in drives:
                    return k
    except KeyboardInterrupt:
        return None
    finally:
        _clear_tui()


def interactive_pick(initial_query: str, db: dict, scope: str = "local") -> str | None:
    global _drawn
    _drawn = 0
    _enable_ansi()
    _tty.write("\033[?25l")
    _tty.write(f"\033[2K\r  {_DM}Scanning directories ({scope})...{_RS}")
    _tty.flush()

    dirs, scope_label = _discover(scope)

    query    = initial_query
    selected = 0
    results  = rank(query, db, dirs)

    try:
        while True:
            _render(query, results, selected, scope_label)
            key = _getch()
            if key is None:
                continue
            if key == 'ESC':
                return None
            if key == 'ENTER':
                return results[selected][0] if results else None
            if key == 'UP':
                selected = max(0, selected - 1)
            elif key == 'DOWN':
                selected = min(len(results) - 1, selected + 1) if results else 0
            elif key == 'BACKSPACE':
                query = query[:-1]; results = rank(query, db, dirs); selected = 0
            elif key == 'DEL':
                query = "";         results = rank(query, db, dirs); selected = 0
            elif isinstance(key, str) and len(key) == 1 and ord(key) >= 32:
                query += key;       results = rank(query, db, dirs); selected = 0
    except KeyboardInterrupt:
        return None
    finally:
        _clear_tui()


# ---------------------------------------------------------------------------
# Shell integration
# ---------------------------------------------------------------------------

_BASH_INIT = '''\
# JumpDir Advanced
j() {{
    local scope="local" query=""
    for arg in "$@"; do
        case "$arg" in
            -g) scope="global" ;;
            -[a-zA-Z]) scope="${{arg#-}}" ;;
            *) query="$arg" ;;
        esac
    done
    local result
    result=$(python3 "{script}" --scope "$scope" --pick "$query" </dev/tty)
    [ -z "$result" ] && return 0
    python3 "{script}" --add "$result" 2>/dev/null
    cd "$result" || return 1
}}
_jd_track() {{ python3 "{script}" --add "$PWD" 2>/dev/null & }}
PROMPT_COMMAND="_jd_track${{PROMPT_COMMAND:+;$PROMPT_COMMAND}}"
'''

_ZSH_INIT = '''\
# JumpDir Advanced
j() {{
    local scope="local" query=""
    for arg in "$@"; do
        case "$arg" in
            -g) scope="global" ;;
            -[a-zA-Z]) scope="${{arg#-}}" ;;
            *) query="$arg" ;;
        esac
    done
    local result
    result=$(python3 "{script}" --scope "$scope" --pick "$query" </dev/tty)
    [ -z "$result" ] && return 0
    python3 "{script}" --add "$result" 2>/dev/null
    cd "$result" || return 1
}}
autoload -Uz add-zsh-hook
_jd_track() {{ python3 "{script}" --add "$PWD" 2>/dev/null & }}
add-zsh-hook chpwd _jd_track
'''

_BAT_CONTENT = r"""@echo off
set JD_SCOPE=local
set JD_QUERY=

:parse
if "%~1"=="" goto run
if /i "%~1"=="-g" (set JD_SCOPE=global & shift & goto parse)
if "%~1:~0,1%"=="-" (set JD_SCOPE=%~1:~1% & shift & goto parse)
set JD_QUERY=%~1
shift
goto parse

:run
set JD_TMP=%TEMP%\jd_result.txt
python "%~dp0jumpdir.py" --scope "%JD_SCOPE%" --pick-to "%JD_TMP%" %JD_QUERY%
if exist "%JD_TMP%" (
    set /p JD_R=<"%JD_TMP%"
    del "%JD_TMP%" 2>nul
    if defined JD_R (
        python "%~dp0jumpdir.py" --add "%JD_R%" 2>nul
        cd /d "%JD_R%"
    )
)
"""


def make_bat() -> None:
    bat = Path(__file__).parent / "j.bat"
    bat.write_text(_BAT_CONTENT)
    print(f"Created: {bat}")
    print(f"Add this folder to PATH:  {bat.parent}")
    print()
    print("Usage:")
    print("  j            search current directory tree")
    print("  j -d proj    search D: drive for 'proj'")
    print("  j -g proj    search all drives for 'proj'")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="JumpDir Advanced", add_help=True)
    parser.add_argument("--init",      action="store_true")
    parser.add_argument("--init-zsh",  action="store_true")
    parser.add_argument("--make-bat",  action="store_true")
    parser.add_argument("--add",       metavar="PATH")
    parser.add_argument("--scope",     default="local", metavar="SCOPE",
                        help="local | global | drive letter (D, C, ...)")
    parser.add_argument("--pick",      nargs="?", const="", metavar="QUERY")
    parser.add_argument("--pick-to",   metavar="FILE")
    # Short scope flags
    parser.add_argument("-g", dest="global_search", action="store_true")
    parser.add_argument("-d", dest="drive_d", action="store_true")
    parser.add_argument("-c", dest="drive_c", action="store_true")
    parser.add_argument("query",       nargs="?", default="")
    args = parser.parse_args()

    script = Path(__file__).resolve()

    if args.make_bat:  make_bat(); return
    if args.init:      print(_BASH_INIT.format(script=script)); return
    if args.init_zsh:  print(_ZSH_INIT.format(script=script)); return
    if args.add:       record_visit(args.add); return

    # Resolve scope — if no flag given, show scope picker first
    explicit_scope = args.global_search or args.drive_d or args.drive_c or (args.scope != "local")
    scope = args.scope
    if args.global_search: scope = "global"
    elif args.drive_d:     scope = "D"
    elif args.drive_c:     scope = "C"

    if not explicit_scope:
        scope = pick_scope()
        if scope is None:
            return   # user pressed Esc at scope menu

    db   = load_db()
    seed = args.pick if args.pick is not None else args.query

    chosen = interactive_pick(seed, db, scope)
    if chosen:
        if args.pick_to:
            Path(args.pick_to).write_text(chosen)
        else:
            print(chosen)


if __name__ == "__main__":
    main()
