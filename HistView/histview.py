#!/usr/bin/env python3
"""
HistView — Terminal History Viewer

No more "what was that command..." moments.
Browse, search, and understand your entire shell history with full context.

Usage:
  python3 histview.py                   Interactive TUI
  python3 histview.py --install bash    Install shell hooks (bash/zsh/fish/pwsh)
  python3 histview.py --import          Import existing shell history
  python3 histview.py --record ...      Record a command (called by hooks)
  python3 histview.py --stats           Quick statistics dump
  python3 histview.py --search QUERY    Non-interactive search
  python3 histview.py --export [FILE]   Export history as shell script
"""

import sys, os, re, sqlite3, json, subprocess, hashlib, platform
import argparse, textwrap, signal, time, shutil
from pathlib import Path
from datetime import datetime, timedelta
from collections import Counter

# ─── Platform ─────────────────────────────────────────────────────────────────
IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"

if IS_WIN:
    import msvcrt
    try:
        import ctypes
        k32 = ctypes.windll.kernel32
        k32.SetConsoleMode(k32.GetStdHandle(-10), 0x0200)
        k32.SetConsoleMode(k32.GetStdHandle(-11), 0x0007)
    except Exception:
        pass
else:
    import termios, tty, fcntl

# ─── ANSI ─────────────────────────────────────────────────────────────────────
R   = "\033[0m"
B   = "\033[1m"
DIM = "\033[2m"

def fg(n): return f"\033[38;5;{n}m"
def bg(n): return f"\033[48;5;{n}m"

C_TITLE    = fg(39)   # cyan — app title
C_BORDER   = fg(238)  # dark gray — dividers
C_SEL_BG   = bg(237)  # selected row background
C_SEL_FG   = fg(255)  # selected row text
C_DIM      = fg(244)  # muted text
C_DATE     = fg(180)  # day-group headers
C_SUCCESS  = fg(82)   # exit 0
C_FAIL     = fg(196)  # non-zero exit
C_BOOKMARK = fg(220)  # ★
C_KEY      = fg(213)  # keyboard shortcut labels

# ─── Categories ───────────────────────────────────────────────────────────────
# Each entry: (compiled_pattern, icon, color)
CATS = {
    "git":    (re.compile(r"^git\b"),                                           "↔ ", fg(214)),
    "docker": (re.compile(r"^docker\b|^docker-compose\b|^compose\b"),          "⬡ ", fg(39)),
    "npm":    (re.compile(r"^npm\b|^yarn\b|^pnpm\b|^bun\b"),                   "⬡ ", fg(124)),
    "python": (re.compile(r"^python[23]?\b|^pip[23]?\b|^uv\b|^poetry\b"),      "⬡ ", fg(220)),
    "dotnet": (re.compile(r"^dotnet\b"),                                        "◆ ", fg(135)),
    "rust":   (re.compile(r"^cargo\b|^rustc\b|^rustup\b"),                     "⚙ ", fg(202)),
    "go":     (re.compile(r"^go\b"),                                            "⬡ ", fg(36)),
    "k8s":    (re.compile(r"^kubectl\b|^helm\b|^k9s\b|^minikube\b"),           "⛵ ", fg(63)),
    "db":     (re.compile(r"^mysql\b|^psql\b|^sqlite3\b|^mongo\b|^redis-cli\b"), "⊞ ", fg(33)),
    "net":    (re.compile(r"^curl\b|^wget\b|^ssh\b|^scp\b|^rsync\b|^ping\b|^nc\b"), "⊕ ", fg(46)),
    "sys":    (re.compile(r"^sudo\b|^apt\b|^apt-get\b|^brew\b|^yum\b|^dnf\b|^pacman\b|^systemctl\b|^kill\b|^ps\b"), "⚒ ", fg(202)),
    "file":   (re.compile(r"^ls\b|^ll\b|^la\b|^cd\b|^cp\b|^mv\b|^rm\b|^mkdir\b|^find\b|^cat\b|^less\b|^touch\b|^ln\b"), "▤ ", fg(69)),
    "editor": (re.compile(r"^vi\b|^vim\b|^nvim\b|^nano\b|^emacs\b|^code\b"),  "✎ ", fg(148)),
    "make":   (re.compile(r"^make\b|^cmake\b|^ninja\b"),                       "⚒ ", fg(178)),
    "shell":  (re.compile(r"^echo\b|^export\b|^source\b|^\. |^alias\b|^env\b"), "$ ", fg(180)),
    "misc":   (re.compile(r".*"),                                               "· ", fg(244)),
}

def categorize(cmd: str):
    """Return (name, icon, color) for a command string."""
    stripped = cmd.strip().split()[0] if cmd.strip() else ""
    for name, (pat, icon, color) in CATS.items():
        if pat.match(stripped) or (name == "misc" and pat.match(cmd.strip())):
            return name, icon, color
    return "misc", "· ", fg(244)

# ─── Database ─────────────────────────────────────────────────────────────────
DB_DIR  = Path.home() / ".local" / "share" / "histview"
DB_PATH = DB_DIR / "histview.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS commands (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    cmd          TEXT    NOT NULL,
    cmd_hash     TEXT,
    ts           INTEGER NOT NULL,
    cwd          TEXT,
    git_branch   TEXT,
    exit_code    INTEGER,
    duration_ms  INTEGER,
    session_id   TEXT,
    category     TEXT,
    bookmarked   INTEGER DEFAULT 0,
    note         TEXT,
    output_head  TEXT,
    source       TEXT DEFAULT 'import'
);
CREATE INDEX IF NOT EXISTS idx_ts         ON commands(ts);
CREATE INDEX IF NOT EXISTS idx_hash       ON commands(cmd_hash);
CREATE INDEX IF NOT EXISTS idx_cat        ON commands(category);
CREATE INDEX IF NOT EXISTS idx_bookmarked ON commands(bookmarked);
"""

def get_db():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    return conn

def cmd_hash(cmd: str) -> str:
    return hashlib.sha256(cmd.strip().encode()).hexdigest()[:16]

# ─── History import ───────────────────────────────────────────────────────────
def _parse_bash_history(path: Path):
    cmds = []
    try:
        content = path.read_bytes().decode("utf-8", errors="replace")
        ts = None
        for line in content.splitlines():
            m = re.match(r"^#(\d{10})$", line)
            if m:
                ts = int(m.group(1)) * 1000
                continue
            line = line.strip()
            if line:
                cmds.append((line, ts or int(time.time() * 1000), None))
                ts = None
    except Exception:
        pass
    return cmds

def _parse_zsh_history(path: Path):
    cmds = []
    try:
        content = path.read_bytes().decode("utf-8", errors="replace")
        for line in content.splitlines():
            m = re.match(r"^: (\d+):(\d+);(.+)$", line)
            if m:
                cmds.append((m.group(3), int(m.group(1)) * 1000, int(m.group(2)) * 1000))
            elif line.strip() and not line.startswith(":"):
                cmds.append((line.strip(), int(time.time() * 1000), None))
    except Exception:
        pass
    return cmds

def _parse_fish_history(path: Path):
    cmds = []
    try:
        content = path.read_bytes().decode("utf-8", errors="replace")
        cmd = ts = None
        for line in content.splitlines():
            m = re.match(r"^- cmd: (.+)$", line)
            if m:
                if cmd:
                    cmds.append((cmd, ts or int(time.time() * 1000), None))
                cmd, ts = m.group(1), None
                continue
            m = re.match(r"^\s+when: (\d+)$", line)
            if m:
                ts = int(m.group(1)) * 1000
        if cmd:
            cmds.append((cmd, ts or int(time.time() * 1000), None))
    except Exception:
        pass
    return cmds

def import_history(verbose=False):
    """Import bash/zsh/fish history files. Returns count of inserted rows."""
    home = Path.home()
    sources = []
    for path, parser, shell in [
        (home / ".bash_history",                          _parse_bash_history, "bash"),
        (home / ".zsh_history",                           _parse_zsh_history,  "zsh"),
        (home / ".config/zsh/.zsh_history",               _parse_zsh_history,  "zsh"),
        (home / ".local/share/fish/fish_history",         _parse_fish_history, "fish"),
    ]:
        if path.exists():
            sources.append((shell, path, parser(path)))

    total = 0
    conn = get_db()
    for shell, path, entries in sources:
        inserted = 0
        for cmd, ts, dur in entries:
            cmd = cmd.strip()
            if not cmd:
                continue
            h = cmd_hash(cmd)
            cat, _, _ = categorize(cmd)
            try:
                conn.execute(
                    "INSERT INTO commands(cmd,cmd_hash,ts,category,duration_ms,source) VALUES(?,?,?,?,?,?)",
                    (cmd, h, ts, cat, dur, f"import:{shell}")
                )
                inserted += 1
            except Exception:
                pass
        conn.commit()
        total += inserted
        if verbose:
            print(f"  {shell}: {inserted:,} commands  ({path})")
    conn.close()
    return total

# ─── Record (called by shell hooks) ───────────────────────────────────────────
def record_command(cmd, cwd, exit_code, duration_ms, git_branch, session_id, output_head=None):
    if not cmd or not cmd.strip():
        return
    cmd = cmd.strip()
    if re.match(r"^(python3?\s.*histview\.py|histview\b)", cmd):
        return
    h = cmd_hash(cmd)
    cat, _, _ = categorize(cmd)
    conn = get_db()
    conn.execute(
        "INSERT INTO commands(cmd,cmd_hash,ts,cwd,git_branch,exit_code,duration_ms,session_id,category,output_head,source) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (cmd, h, int(time.time() * 1000), cwd, git_branch or None,
         exit_code if exit_code is not None else None,
         duration_ms or None, session_id or None, cat, output_head, "hook")
    )
    conn.commit()
    conn.close()

# ─── Shell hooks ──────────────────────────────────────────────────────────────
_BASH_HOOK = """\
# ── HistView Integration ──────────────────────────────────────────────────────
export HISTVIEW_SESSION="${{HISTVIEW_SESSION:-$(date +%s)-$$}}"
_hv_start=0; _hv_cmd=""; _hv_branch=""
_hv_preexec() {{
    [[ "$BASH_COMMAND" == _hv_* ]] && return
    _hv_cmd="$BASH_COMMAND"
    _hv_start=$(date +%s%3N 2>/dev/null || echo 0)
    _hv_branch=$(git branch --show-current 2>/dev/null)
}}
trap '_hv_preexec' DEBUG
_hv_precmd() {{
    local _ec=$?
    [[ -z "$_hv_cmd" ]] && return
    local _end=$(date +%s%3N 2>/dev/null || echo 0)
    python3 "{script}" --record --cmd "$_hv_cmd" --cwd "$PWD" \\
        --exit "$_ec" --duration "$(( _end - _hv_start ))" \\
        --branch "$_hv_branch" --session "$HISTVIEW_SESSION" &>/dev/null &
    _hv_cmd=""
}}
PROMPT_COMMAND="_hv_precmd${{PROMPT_COMMAND:+; $PROMPT_COMMAND}}"
# ─────────────────────────────────────────────────────────────────────────────
"""

_ZSH_HOOK = """\
# ── HistView Integration ──────────────────────────────────────────────────────
export HISTVIEW_SESSION="${{HISTVIEW_SESSION:-$(date +%s)-$$}}"
_hv_start=0; _hv_cmd=""
_hv_preexec() {{
    _hv_cmd="$1"
    _hv_start=$(($(date +%s%3N 2>/dev/null || echo 0)))
    _hv_branch=$(git branch --show-current 2>/dev/null)
}}
_hv_precmd() {{
    local _ec=$?
    [[ -z "$_hv_cmd" ]] && return
    python3 "{script}" --record --cmd "$_hv_cmd" --cwd "$PWD" \\
        --exit "$_ec" --duration "$(( $(date +%s%3N 2>/dev/null || echo 0) - _hv_start ))" \\
        --branch "${{_hv_branch:-}}" --session "$HISTVIEW_SESSION" &>/dev/null &
    _hv_cmd=""
}}
autoload -Uz add-zsh-hook
add-zsh-hook preexec _hv_preexec
add-zsh-hook precmd  _hv_precmd
# ─────────────────────────────────────────────────────────────────────────────
"""

_FISH_HOOK = """\
# HistView integration — save as ~/.config/fish/conf.d/histview.fish
set -x HISTVIEW_SESSION (date +%s)-(echo $fish_pid)
function _hv_preexec --on-event fish_preexec
    set -g _hv_cmd $argv[1]
    set -g _hv_start (date +%s%3N 2>/dev/null; or echo 0)
    set -g _hv_branch (git branch --show-current 2>/dev/null; or echo "")
end
function _hv_postcmd --on-event fish_postexec
    set -l ec $status
    test -z "$_hv_cmd"; and return
    set -l _end (date +%s%3N 2>/dev/null; or echo 0)
    python3 "{script}" --record --cmd "$_hv_cmd" --cwd (pwd) \\
        --exit $ec --duration (math $_end - $_hv_start) \\
        --branch "$_hv_branch" --session "$HISTVIEW_SESSION" &>/dev/null &
    set -g _hv_cmd ""
end
"""

_PWSH_HOOK = """\
# HistView integration — add to $PROFILE
$env:HISTVIEW_SESSION = "$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$PID"
$_hv_start = 0; $_hv_cmd = ""
$_hv_orig_prompt = $Function:prompt

function prompt {{
    $ec = $LASTEXITCODE
    if ($_hv_cmd -and $_hv_cmd -notmatch 'histview') {{
        $dur = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $_hv_start
        $br = (git branch --show-current 2>$null)
        & python3 "{script}" --record --cmd "$_hv_cmd" --cwd "$PWD" `
            --exit $ec --duration $dur --branch "$br" --session "$env:HISTVIEW_SESSION" 2>$null
    }}
    $_hv_cmd = ""
    & $_hv_orig_prompt
}}
Set-PSReadLineOption -AddToHistoryHandler {{
    param($cmd)
    $script:_hv_cmd = $cmd
    $script:_hv_start = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $true
}}
"""

def install_hooks(shell: str, script_path: str):
    templates = {
        "bash": (_BASH_HOOK, Path.home() / ".bashrc",    False),
        "zsh":  (_ZSH_HOOK,  Path.home() / ".zshrc",     False),
        "fish": (_FISH_HOOK,  Path.home() / ".config/fish/conf.d/histview.fish", True),
        "pwsh": (_PWSH_HOOK,  Path.home() / "Documents/PowerShell/Microsoft.PowerShell_profile.ps1", False),
        "powershell": (_PWSH_HOOK, Path.home() / "Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1", False),
    }
    if shell not in templates:
        print(f"Unknown shell '{shell}'. Supported: bash, zsh, fish, pwsh, powershell")
        return

    tmpl, target, overwrite = templates[shell]
    snippet = tmpl.format(script=script_path)
    marker  = "HistView Integration"

    if overwrite:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(snippet)
        print(f"Installed {shell} hook → {target}")
        if shell == "fish":
            print("Reload: source ~/.config/fish/conf.d/histview.fish")
        return

    existing = target.read_text() if target.exists() else ""
    if marker in existing:
        print(f"Hook already present in {target}")
        return

    with target.open("a") as f:
        f.write("\n" + snippet)
    print(f"Installed {shell} hook → {target}")
    print(f"Reload: source {target}")

# ─── Clipboard ────────────────────────────────────────────────────────────────
def copy_to_clipboard(text: str) -> bool:
    try:
        if IS_WIN:
            subprocess.run(["clip"], input=text.encode(), check=True, timeout=3)
        elif IS_MAC:
            subprocess.run(["pbcopy"], input=text.encode(), check=True, timeout=3)
        else:
            for tool in [["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]]:
                if shutil.which(tool[0]):
                    subprocess.run(tool, input=text.encode(), check=True, timeout=3)
                    return True
            return False
        return True
    except Exception:
        return False

# ─── TTY helpers ──────────────────────────────────────────────────────────────
def _open_tty():
    if IS_WIN:
        return open("CONOUT$", "w", encoding="utf-8", errors="replace")
    return open("/dev/tty", "w", encoding="utf-8", errors="replace")

def _raw_mode(fd):
    if IS_WIN:
        return None
    old = termios.tcgetattr(fd)
    tty.setraw(fd)
    return old

def _restore_mode(fd, old):
    if IS_WIN or old is None:
        return
    termios.tcsetattr(fd, termios.TCSAFLUSH, old)

_ESC_MAP = {
    "\x1b[A": "UP",   "\x1b[B": "DOWN",  "\x1b[C": "RIGHT", "\x1b[D": "LEFT",
    "\x1bOA": "UP",   "\x1bOB": "DOWN",  "\x1bOC": "RIGHT", "\x1bOD": "LEFT",
    "\x1b[5~": "PAGEUP", "\x1b[6~": "PAGEDOWN",
    "\x1b[H": "HOME", "\x1b[F": "END",
    "\x1b[1~": "HOME", "\x1b[4~": "END",
}

def _read_key(fd=None):
    if IS_WIN:
        ch = msvcrt.getwch()
        if ch in ("\x00", "\xe0"):
            ch2 = msvcrt.getwch()
            return {"H":"UP","P":"DOWN","K":"LEFT","M":"RIGHT","I":"PAGEUP","Q":"PAGEDOWN","G":"HOME","O":"END"}.get(ch2, "")
        return ch

    if fd is None:
        fd = sys.stdin.fileno()
    ch = os.read(fd, 1).decode("utf-8", errors="replace")
    if ch != "\x1b":
        return ch

    # Read escape sequence in non-blocking mode
    old_fl = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, old_fl | os.O_NONBLOCK)
    rest = b""
    try:
        for _ in range(8):
            try:
                rest += os.read(fd, 1)
            except (BlockingIOError, OSError):
                break
    finally:
        fcntl.fcntl(fd, fcntl.F_SETFL, old_fl)

    if not rest:
        return "ESC"
    seq = ch + rest.decode("utf-8", errors="replace")
    for code, name in _ESC_MAP.items():
        if seq.startswith(code[1:]):
            return name
    return "ESC"

def _term_size():
    try:
        return os.get_terminal_size()
    except Exception:
        return os.terminal_size((80, 24))

# ─── Query helpers ────────────────────────────────────────────────────────────
def fetch_commands(conn, search="", category="", bookmarked_only=False, limit=3000):
    where, params = ["1=1"], []
    if search:
        for t in search.lower().split():
            where.append("(lower(cmd) LIKE ? OR lower(COALESCE(cwd,'')) LIKE ? OR lower(COALESCE(note,'')) LIKE ?)")
            params += [f"%{t}%", f"%{t}%", f"%{t}%"]
    if category:
        where.append("category=?"); params.append(category)
    if bookmarked_only:
        where.append("bookmarked=1")
    sql = (
        "SELECT id,cmd,ts,cwd,git_branch,exit_code,duration_ms,session_id,"
        "category,bookmarked,note,output_head,source,cmd_hash "
        "FROM commands WHERE " + " AND ".join(where) +
        " ORDER BY ts DESC LIMIT ?"
    )
    return conn.execute(sql, params + [limit]).fetchall()

def get_stats(conn):
    total     = conn.execute("SELECT COUNT(*) FROM commands").fetchone()[0]
    sessions  = conn.execute("SELECT COUNT(DISTINCT session_id) FROM commands WHERE session_id IS NOT NULL").fetchone()[0]
    cats      = conn.execute("SELECT category,COUNT(*) n FROM commands GROUP BY category ORDER BY n DESC LIMIT 10").fetchall()
    top_cmds  = conn.execute("SELECT cmd,COUNT(*) n FROM commands GROUP BY cmd_hash ORDER BY n DESC LIMIT 12").fetchall()
    days      = conn.execute("SELECT COUNT(DISTINCT DATE(ts/1000,'unixepoch')) FROM commands").fetchone()[0]
    fails     = conn.execute("SELECT COUNT(*) FROM commands WHERE exit_code!=0 AND exit_code IS NOT NULL").fetchone()[0]
    bookmarks = conn.execute("SELECT COUNT(*) FROM commands WHERE bookmarked=1").fetchone()[0]
    # Hour-of-day distribution for heatmap
    hours     = conn.execute("SELECT CAST(strftime('%H',ts/1000,'unixepoch') AS INTEGER) h,COUNT(*) n FROM commands GROUP BY h").fetchall()
    return dict(total=total, sessions=sessions, cats=cats, top_cmds=top_cmds,
                days=days, fails=fails, bookmarks=bookmarks, hours=hours)

def run_count(conn, h: str) -> int:
    return conn.execute("SELECT COUNT(*) FROM commands WHERE cmd_hash=?", (h,)).fetchone()[0]

# ─── Display helpers ──────────────────────────────────────────────────────────
def ts_label(ts_ms: int) -> str:
    if not ts_ms:
        return "unknown"
    dt   = datetime.fromtimestamp(ts_ms / 1000)
    diff = (datetime.now() - dt).days
    if diff == 0: return f"Today {dt.strftime('%H:%M')}"
    if diff == 1: return f"Yesterday {dt.strftime('%H:%M')}"
    if diff < 7:  return dt.strftime("%A %H:%M")
    return dt.strftime("%b %d  %H:%M")

def day_group(ts_ms: int) -> str:
    if not ts_ms:
        return "Unknown"
    dt   = datetime.fromtimestamp(ts_ms / 1000)
    diff = (datetime.now().date() - dt.date()).days
    if diff == 0: return "Today"
    if diff == 1: return "Yesterday"
    if diff < 7:  return dt.strftime("%A")
    if diff < 30: return dt.strftime("%b %d")
    return dt.strftime("%B %Y")

def fmt_dur(ms) -> str:
    if ms is None: return ""
    if ms < 1000:  return f"{ms}ms"
    if ms < 60000: return f"{ms/1000:.1f}s"
    return f"{ms//60000}m{(ms%60000)//1000}s"

def trunc(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n-1] + "…"

def shrink_path(p: str) -> str:
    if not p: return ""
    home = str(Path.home())
    if p.startswith(home):
        p = "~" + p[len(home):]
    parts = p.split("/") if "/" in p else p.split("\\")
    if len(parts) > 4:
        return parts[0] + "/" + parts[1] + "/…/" + "/".join(parts[-2:])
    return p

def strip_ansi(s: str) -> str:
    return re.sub(r"\033\[[^m]*m", "", s)

# ─── Views ────────────────────────────────────────────────────────────────────
V_TIMELINE  = "timeline"
V_STATS     = "stats"
V_BOOKMARKS = "bookmarks"
V_HELP      = "help"

# ─── TUI ──────────────────────────────────────────────────────────────────────
class HistViewTUI:
    def __init__(self):
        self.conn        = get_db()
        self.tty         = _open_tty()
        self.view        = V_TIMELINE
        self.search      = ""
        self.search_mode = False
        self.category    = ""
        self.rows        = []
        self.cursor      = 0
        self.list_off    = 0       # list scroll offset
        self._running    = True
        self._status     = ""
        self._status_at  = 0.0
        self._stats_cache = None
        self._stats_dirty = True
        self.W, self.H   = 80, 24
        self._refresh_size()
        self._reload()

    # ── Low-level output ──────────────────────────────────────────────────────
    def _w(self, s):
        self.tty.write(s)

    def _flush(self):
        self.tty.flush()

    def _at(self, r, c, s=""):
        self._w(f"\033[{r};{c}H{s}")

    def _fill(self, row, s, width=None):
        w = width or self.W
        pad = max(0, w - len(strip_ansi(s)))
        self._at(row, 1, s + " " * pad)

    def _refresh_size(self):
        sz = _term_size()
        self.W, self.H = sz.columns, sz.lines

    # ── Data ──────────────────────────────────────────────────────────────────
    def _reload(self):
        bm = (self.view == V_BOOKMARKS)
        self.rows = list(fetch_commands(self.conn, self.search, self.category, bm))
        self._stats_dirty = True
        if self.cursor >= len(self.rows):
            self.cursor = max(0, len(self.rows) - 1)

    def _stats(self):
        if self._stats_dirty or self._stats_cache is None:
            self._stats_cache = get_stats(self.conn)
            self._stats_dirty = False
        return self._stats_cache

    def _set_status(self, msg, dur=2.5):
        self._status   = msg
        self._status_at = time.time()
        self._status_dur = dur

    # ── Header ────────────────────────────────────────────────────────────────
    def _draw_header(self):
        tabs = [("[T]imeline", V_TIMELINE), ("[S]tats", V_STATS),
                ("[B]ookmarks", V_BOOKMARKS), ("[?]Help", V_HELP)]
        tab_str = "  ".join(
            f"{B}{fg(255)}{C_SEL_BG} {n} {R}" if v == self.view else f"{C_DIM}{n}{R}"
            for n, v in tabs
        )
        self._fill(1, f"{bg(235)} {B}{C_TITLE}HistView{R}  {tab_str}")
        # search / hint bar
        if self.search_mode:
            bar = f"{bg(234)} {C_KEY}/search:{R} {B}{self.search}{R}█"
        elif self.search:
            bar = f"{bg(234)} {C_KEY}Filter:{R} {C_TITLE}{self.search}{R}  {C_DIM}[ESC] clear{R}"
        elif self.category:
            _, icon, col = CATS.get(self.category, ("", "· ", C_DIM))
            bar = f"{bg(234)} {C_KEY}Category:{R} {col}{icon}{self.category}{R}  {C_DIM}[ESC] clear{R}"
        else:
            bar = f"{bg(234)}{C_DIM}  [/] search  [↑↓/jk] navigate  [Y] copy  [R] re-run  [B] bookmark  [q] quit{R}"
        self._fill(2, bar)
        self._at(3, 1, C_BORDER + "─" * self.W + R)

    # ── Status bar ────────────────────────────────────────────────────────────
    def _draw_statusbar(self):
        if self._status and time.time() - self._status_at < getattr(self, "_status_dur", 2.5):
            msg = f" {C_KEY}{self._status}{R}"
        else:
            s = self._stats()
            shown = len(self.rows)
            cat_parts = "  ".join(
                f"{CATS.get(c['category'], ('','',''))[2]}{c['category']}({c['n']}){R}"
                for c in list(s["cats"])[:3]
            )
            msg = f" {C_DIM}{shown:,}/{s['total']:,} cmds · {s['sessions']} sessions · {s['days']} days  {cat_parts}{R}"
        self._fill(self.H, f"{bg(235)}{msg}")

    # ── List panel ────────────────────────────────────────────────────────────
    def _lw(self):
        """List panel width (left side)."""
        return max(30, min(54, self.W // 2))

    def _draw_list(self):
        lw      = self._lw()
        rows    = self.rows
        vis_h   = self.H - 4

        # Adjust scroll offset
        if self.cursor < self.list_off:
            self.list_off = self.cursor
        if self.cursor >= self.list_off + vis_h:
            self.list_off = self.cursor - vis_h + 1

        last_grp  = None
        scr_row   = 4
        idx       = self.list_off

        while scr_row <= self.H - 1 and idx < len(rows):
            r = rows[idx]
            grp = day_group(r["ts"])
            if grp != last_grp:
                if scr_row <= self.H - 1:
                    self._fill(scr_row, f" {C_DATE}{B}{grp}{R}", lw)
                    scr_row += 1
                    last_grp = grp
                if scr_row > self.H - 1:
                    break
            self._draw_list_row(scr_row, r, lw, idx == self.cursor)
            scr_row += 1
            idx += 1

        while scr_row <= self.H - 1:
            self._fill(scr_row, "", lw)
            scr_row += 1

        # vertical divider
        for row in range(4, self.H):
            self._at(row, lw + 1, C_BORDER + "│" + R)

    def _draw_list_row(self, row, r, width, selected):
        _, icon, color = categorize(r["cmd"])
        exit_ic = (f"{C_SUCCESS}✓{R}" if r["exit_code"] == 0
                   else f"{C_FAIL}✗{R}" if r["exit_code"] is not None
                   else f"{C_DIM}·{R}")
        bm_ic   = f"{C_BOOKMARK}★{R}" if r["bookmarked"] else "  "
        avail   = width - 8
        cmd_d   = trunc(r["cmd"], avail)

        if selected:
            self._fill(row,
                f"{C_SEL_BG}{C_SEL_FG} {exit_ic}{C_SEL_BG}{C_SEL_FG} {color}{icon}{R}"
                f"{C_SEL_BG}{C_SEL_FG}{B}{cmd_d}{R}{C_SEL_BG} {bm_ic}",
                width)
        else:
            self._fill(row,
                f" {exit_ic} {color}{icon}{R}{cmd_d} {bm_ic}",
                width)

    # ── Detail panel ──────────────────────────────────────────────────────────
    def _draw_detail(self):
        lw  = self._lw()
        dc  = lw + 2        # detail column start
        dw  = self.W - dc   # detail width
        row = [4]           # mutable so inner fn can close over it

        def dline(s=""):
            if row[0] >= self.H:
                return
            self._at(row[0], dc, s)
            pad = max(0, dw - len(strip_ansi(s)))
            self._w(" " * pad)
            row[0] += 1

        def section(title):
            ruler = "─" * max(1, dw - len(title) - 4)
            dline(f"{C_DIM}── {B}{title}{R}{C_DIM} {ruler}{R}")

        if not self.rows:
            dline()
            dline(f"{C_DIM}  No commands found.")
            dline(f"{C_DIM}  Run --import to load your shell history.")
            return

        r   = self.rows[self.cursor]
        cat, icon, color = categorize(r["cmd"])

        # Command block
        dline(f" {B}{color}{icon}{R}{B} Command{R}")
        dline()
        for line in textwrap.wrap(r["cmd"], dw - 3)[:5]:
            dline(f"  {B}{fg(253)}{line}{R}")
        dline()

        # Metadata
        section("Metadata")
        def mrow(label, val, vc=""):
            if not val and val != 0:
                return
            dline(f"  {C_DIM}{label:<10}{R} {vc}{val}{R}")

        mrow("When",   ts_label(r["ts"]),            fg(180))
        if r["cwd"]:
            mrow("Where",  shrink_path(r["cwd"]),    fg(75))
        if r["git_branch"]:
            mrow("Branch", r["git_branch"],          fg(214))
        if r["duration_ms"]:
            mrow("Took",   fmt_dur(r["duration_ms"]),fg(183))
        if r["exit_code"] is not None:
            status_s = f"{C_SUCCESS}✓ success{R}" if r["exit_code"] == 0 else f"{C_FAIL}✗ exit {r['exit_code']}{R}"
            dline(f"  {C_DIM}{'Status':<10}{R} {status_s}")
        mrow("Category", cat,                         color)
        times = run_count(self.conn, r["cmd_hash"] or cmd_hash(r["cmd"]))
        mrow("Frequency", f"run {times}× total",     fg(183))
        mrow("Source",   r["source"] or "",          C_DIM)

        if r["note"]:
            dline()
            section("Note")
            for line in textwrap.wrap(r["note"], dw - 4):
                dline(f"  {fg(229)}{line}{R}")

        if r["output_head"]:
            dline()
            section("Last Output")
            for line in r["output_head"].splitlines()[:6]:
                dline(f"  {C_DIM}{trunc(line, dw - 3)}{R}")

        dline()
        section("Actions")
        dline(f"  {C_KEY}[Y]{R} copy   {C_KEY}[R]{R} re-run+capture  {C_KEY}[D]{R} delete")
        dline(f"  {C_KEY}[b]{R} bookmark  {C_KEY}[N]{R} note  {C_KEY}[C]{R} filter cat  {C_KEY}[E]{R} export")

        while row[0] < self.H:
            dline()

    # ── Stats view ────────────────────────────────────────────────────────────
    def _draw_stats(self):
        s   = self._stats()
        row = [4]
        w   = self.W - 4

        def sline(s=""):
            if row[0] >= self.H:
                return
            self._at(row[0], 3, s)
            pad = max(0, w - len(strip_ansi(s)))
            self._w(" " * pad)
            row[0] += 1

        sline(f"{B}{C_TITLE} History Analytics{R}")
        sline()

        for val, label in [
            (s["total"],    "total commands"),
            (s["sessions"], "sessions"),
            (s["days"],     "active days"),
            (s["fails"],    f"failed ({100*s['fails']//max(s['total'],1)}%)"),
            (s["bookmarks"],"bookmarks"),
        ]:
            bar_w = max(1, min(30, val * 30 // max(s["total"], 1))) if label.startswith("total") else 0
            sline(f"  {B}{fg(255)}{val:>8,}{R}  {C_DIM}{label}{R}")

        sline()
        sline(f"{B}{C_TITLE} By Category{R}")
        sline()
        for cat_row in s["cats"]:
            name  = cat_row["category"]
            count = cat_row["n"]
            _, icon, col = CATS.get(name, ("", "· ", C_DIM))
            bar_w = max(1, min(35, count * 35 // max(s["total"], 1)))
            sline(f"  {col}{icon}{name:<12}{R} {col}{'█' * bar_w}{R} {count:,}")

        sline()
        sline(f"{B}{C_TITLE} Top Commands{R}")
        sline()
        for i, tc in enumerate(s["top_cmds"][:10], 1):
            _, icon, col = categorize(tc["cmd"])
            sline(f"  {C_DIM}{i:>2}.{R} {col}{icon}{R}{trunc(tc['cmd'], 52):<52} {C_DIM}×{tc['n']}{R}")

        sline()
        sline(f"{B}{C_TITLE} Activity by Hour{R}")
        sline()
        hours_map = {r["h"]: r["n"] for r in s["hours"]}
        max_h = max((v for v in hours_map.values()), default=1)
        heat = ""
        for h in range(24):
            n   = hours_map.get(h, 0)
            lvl = int(n * 8 / max_h) if max_h else 0
            blocks = " ▁▂▃▄▅▆▇█"
            heat += blocks[min(lvl, 8)]
        sline(f"  00h {C_TITLE}{heat}{R} 23h")
        sline(f"  {C_DIM}(each block = one hour of the day){R}")

    # ── Help view ─────────────────────────────────────────────────────────────
    def _draw_help(self):
        row = [4]
        w   = self.W - 4

        def hline(s=""):
            if row[0] >= self.H:
                return
            self._at(row[0], 3, s)
            self._w(" " * max(0, w - len(strip_ansi(s))))
            row[0] += 1

        KEYS = [
            ("Navigation",  [
                ("↑ / k",       "Move up"),
                ("↓ / j",       "Move down"),
                ("Page Up/Down","Jump 10 rows"),
                ("g / Home",    "Jump to top"),
                ("G / End",     "Jump to bottom"),
            ]),
            ("Search & Filter",  [
                ("/",           "Enter live search mode"),
                ("ESC",         "Clear search / filter / go back"),
                ("C",           "Filter by category of current selection"),
            ]),
            ("Actions",  [
                ("Y / Enter",   "Copy command to clipboard"),
                ("R",           "Re-run command and capture output"),
                ("b",           "Toggle bookmark (★)"),
                ("N",           "Add / edit note on command"),
                ("D",           "Delete entry from history"),
                ("E",           "Export filtered list as shell script"),
            ]),
            ("Views",  [
                ("T",           "Timeline view (default)"),
                ("S",           "Stats & analytics"),
                ("Shift-B",     "Bookmarks view"),
                ("?",           "This help screen"),
                ("q / Ctrl-C",  "Quit"),
            ]),
            ("Setup",  [
                ("--install bash",    "Install bash shell hooks"),
                ("--install zsh",     "Install zsh shell hooks"),
                ("--install fish",    "Install fish hooks"),
                ("--install pwsh",    "Install PowerShell hooks"),
                ("--import",          "Re-import shell history files"),
                ("--stats",           "Print stats (no TUI)"),
                ("--search QUERY",    "Search without TUI"),
                ("--export FILE.sh",  "Export history as runbook"),
            ]),
        ]

        hline(f"{B}{C_TITLE}  HistView — Keyboard Reference{R}")
        hline()
        for sec, bindings in KEYS:
            hline(f"  {B}{fg(180)}{sec}{R}")
            for key, desc in bindings:
                hline(f"    {C_KEY}{key:<22}{R}{C_DIM}{desc}{R}")
            hline()

    # ── Master draw ───────────────────────────────────────────────────────────
    def draw(self):
        self._w("\033[2J\033[H")
        self._refresh_size()
        self._draw_header()
        if self.view == V_STATS:
            self._draw_stats()
        elif self.view == V_HELP:
            self._draw_help()
        else:
            self._draw_list()
            self._draw_detail()
        self._draw_statusbar()
        self._flush()

    # ── Actions ───────────────────────────────────────────────────────────────
    def _act_copy(self):
        if not self.rows:
            return
        cmd = self.rows[self.cursor]["cmd"]
        ok  = copy_to_clipboard(cmd)
        self._set_status(f"Copied: {trunc(cmd, 50)}" if ok else "Copy failed — clipboard tool missing")

    def _act_bookmark(self):
        if not self.rows:
            return
        r      = self.rows[self.cursor]
        new_bm = 0 if r["bookmarked"] else 1
        self.conn.execute("UPDATE commands SET bookmarked=? WHERE id=?", (new_bm, r["id"]))
        self.conn.commit()
        self._reload()
        self._set_status("★ Bookmarked" if new_bm else "Bookmark removed")

    def _act_delete(self):
        if not self.rows:
            return
        r = self.rows[self.cursor]
        self.conn.execute("DELETE FROM commands WHERE id=?", (r["id"],))
        self.conn.commit()
        self._set_status(f"Deleted: {trunc(r['cmd'], 50)}")
        self._reload()

    def _act_filter_cat(self):
        if not self.rows:
            return
        cat = self.rows[self.cursor]["category"]
        if self.category == cat:
            self.category = ""
            self._set_status("Category filter cleared")
        else:
            self.category = cat
            self._set_status(f"Filtering category: {cat}")
        self.cursor   = 0
        self.list_off = 0
        self._reload()

    def _act_export(self):
        out = Path.home() / f"histview_export_{int(time.time())}.sh"
        with out.open("w") as f:
            f.write("#!/bin/bash\n# HistView export\n\n")
            for r in self.rows:
                ts = datetime.fromtimestamp(r["ts"] / 1000).strftime("%Y-%m-%d %H:%M") if r["ts"] else "?"
                cwd_c = f"  # {shrink_path(r['cwd'])}" if r["cwd"] else ""
                f.write(f"# {ts}{cwd_c}\n{r['cmd']}\n\n")
        out.chmod(0o755)
        self._set_status(f"Exported {len(self.rows):,} cmds → {out.name}")

    def _act_rerun(self, tty_fd, old_mode):
        if not self.rows:
            return
        r   = self.rows[self.cursor]
        cmd = r["cmd"]
        _restore_mode(tty_fd, old_mode)
        self._w("\033[2J\033[H\033[?25h")
        self._flush()
        print(f"\n{B}Re-running:{R} {cmd}\n{'─'*60}")
        output_lines = []
        exit_code    = None
        try:
            proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT, text=True)
            for line in proc.stdout:
                sys.stdout.write(line)
                sys.stdout.flush()
                output_lines.append(line)
            proc.wait()
            exit_code = proc.returncode
        except KeyboardInterrupt:
            print("\n[HistView] Interrupted")
            exit_code = -1

        # Persist output preview
        if output_lines:
            head = "".join(output_lines)[:2000]
            self.conn.execute("UPDATE commands SET output_head=? WHERE id=?", (head, r["id"]))
            self.conn.commit()
            self._reload()

        print(f"\n{'─'*60}")
        print(f"{C_DIM}exit {exit_code}{R}  Press any key to return...", flush=True)
        if IS_WIN:
            msvcrt.getwch()
        else:
            sys.stdin.read(1)

    def _act_note(self, tty_fd, old_mode):
        if not self.rows:
            return
        r = self.rows[self.cursor]
        _restore_mode(tty_fd, old_mode)
        self._w(f"\033[{self.H};1H\033[2K{B}Note> {R}")
        self._flush()
        try:
            note = input("")
            if note is not None:
                self.conn.execute("UPDATE commands SET note=? WHERE id=?",
                                  (note.strip() or None, r["id"]))
                self.conn.commit()
                self._reload()
                self._set_status("Note saved")
        except EOFError:
            pass

    # ── Key handler ───────────────────────────────────────────────────────────
    def handle_key(self, key, tty_fd, old_mode):
        # Search mode — capture typing
        if self.search_mode:
            if key in ("\r", "\n", "ENTER"):
                self.search_mode = False
                self._reload()
            elif key == "ESC":
                self.search      = ""
                self.search_mode = False
                self._reload()
            elif key in ("\x7f", "\x08", "BACKSPACE"):
                self.search = self.search[:-1]
                self._reload()
            elif len(key) == 1 and key.isprintable():
                self.search += key
                self._reload()
            return

        n = len(self.rows)
        if key in ("UP", "k"):
            self.cursor = max(0, self.cursor - 1)
        elif key in ("DOWN", "j"):
            self.cursor = min(n - 1, self.cursor + 1)
        elif key == "PAGEUP":
            self.cursor   = max(0, self.cursor - 10)
            self.list_off = max(0, self.list_off - 10)
        elif key == "PAGEDOWN":
            self.cursor = min(n - 1, self.cursor + 10)
        elif key in ("HOME", "g"):
            self.cursor = 0;  self.list_off = 0
        elif key in ("END", "G"):
            self.cursor = max(0, n - 1)
        elif key == "/":
            self.search_mode = True
        elif key == "ESC":
            self.search   = "";  self.category = ""
            self.search_mode = False
            self._reload()
        elif key in ("t", "T"):
            self.view = V_TIMELINE; self._reload()
        elif key in ("s", "S"):
            self.view = V_STATS
        elif key == "B":                          # Shift+B
            self.view = V_BOOKMARKS; self._reload()
        elif key == "?":
            self.view = V_HELP
        elif key in ("y", "Y", "\r", "\n"):
            self._act_copy()
        elif key in ("r", "R"):
            self._act_rerun(tty_fd, old_mode)
            if not IS_WIN:
                new_old = _raw_mode(tty_fd)
                # update stored old mode for future restores
                self._old_mode = new_old
        elif key in ("b",):
            self._act_bookmark()
        elif key in ("n", "N"):
            self._act_note(tty_fd, old_mode)
            if not IS_WIN:
                self._old_mode = _raw_mode(tty_fd)
        elif key in ("e", "E"):
            self._act_export()
        elif key in ("c", "C"):
            self._act_filter_cat()
        elif key in ("d", "D"):
            self._act_delete()
        elif key in ("q", "Q", "\x03", "\x1c"):
            self._running = False

    # ── Run loop ──────────────────────────────────────────────────────────────
    def run(self):
        tty_fd   = sys.stdin.fileno() if not IS_WIN else None
        old_mode = _raw_mode(tty_fd) if not IS_WIN else None
        self._old_mode = old_mode

        def _sigwinch(*_):
            self._refresh_size()
            self.draw()

        if not IS_WIN:
            signal.signal(signal.SIGWINCH, _sigwinch)

        self._w("\033[?25l")   # hide cursor
        self._flush()

        try:
            self.draw()
            while self._running:
                key = _read_key(tty_fd)
                self.handle_key(key, tty_fd, old_mode)
                self.draw()
        finally:
            _restore_mode(tty_fd, self._old_mode)
            self._w("\033[?25h\033[2J\033[H")  # show cursor, clear
            self._flush()
            self.conn.close()
            self.tty.close()


# ─── Non-interactive commands ─────────────────────────────────────────────────
def cmd_stats_print():
    conn = get_db()
    s    = get_stats(conn)
    conn.close()
    print(f"\n{B}HistView — History Stats{R}")
    print(f"  Commands  : {s['total']:,}")
    print(f"  Sessions  : {s['sessions']:,}")
    print(f"  Days      : {s['days']:,}")
    print(f"  Failures  : {s['fails']:,}")
    print(f"  Bookmarks : {s['bookmarks']:,}")
    print(f"\n  Top categories:")
    for c in s["cats"]:
        _, icon, col = CATS.get(c["category"], ("", "· ", ""))
        print(f"    {col}{icon}{c['category']:<12}{R}  {c['n']:,}")
    print(f"\n  Top commands:")
    for i, tc in enumerate(s["top_cmds"], 1):
        print(f"  {i:>2}. {trunc(tc['cmd'], 60):<60}  ×{tc['n']}")

def cmd_search_print(query: str):
    conn = get_db()
    rows = fetch_commands(conn, search=query, limit=50)
    conn.close()
    if not rows:
        print("No results.")
        return
    for r in rows:
        _, icon, col = categorize(r["cmd"])
        ts = ts_label(r["ts"]) if r["ts"] else "?"
        ok = (f"{C_SUCCESS}✓{R}" if r["exit_code"] == 0
              else f"{C_FAIL}✗{R}" if r["exit_code"] is not None else "·")
        cwd_s = f"  {C_DIM}{shrink_path(r['cwd'] or '')}{R}" if r["cwd"] else ""
        print(f"  {ok} {col}{icon}{R}{r['cmd']:<60}  {C_DIM}{ts}{R}{cwd_s}")

def cmd_export_print(path: str = None):
    conn = get_db()
    rows = list(fetch_commands(conn, limit=500000))
    conn.close()
    out  = Path(path) if path else Path.home() / f"histview_export_{int(time.time())}.sh"
    with out.open("w") as f:
        f.write("#!/bin/bash\n# HistView full export\n# " + datetime.now().isoformat() + "\n\n")
        for r in reversed(rows):
            ts = datetime.fromtimestamp(r["ts"] / 1000).strftime("%Y-%m-%d %H:%M") if r["ts"] else "?"
            cwd_c = f"  # {shrink_path(r['cwd'])}" if r["cwd"] else ""
            f.write(f"# {ts}{cwd_c}\n{r['cmd']}\n\n")
    out.chmod(0o755)
    print(f"Exported {len(rows):,} commands → {out}")

# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(
        prog="histview",
        description="HistView — Terminal History Viewer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
        Examples:
          python3 histview.py                      Interactive TUI
          python3 histview.py --install bash       Add shell hooks to .bashrc
          python3 histview.py --install zsh        Add shell hooks to .zshrc
          python3 histview.py --install fish       Add fish hooks
          python3 histview.py --install pwsh       Add PowerShell hooks
          python3 histview.py --import             Import existing history files
          python3 histview.py --stats              Quick statistics dump
          python3 histview.py --search docker      Non-interactive search
          python3 histview.py --export ~/cmds.sh   Export history as shell script
        """),
    )
    ap.add_argument("--install",   metavar="SHELL",
                    help="Install shell hooks: bash | zsh | fish | pwsh")
    ap.add_argument("--import",    dest="do_import", action="store_true",
                    help="Import existing shell history into the database")
    ap.add_argument("--record",    action="store_true",
                    help="Record a command (called by shell hooks)")
    ap.add_argument("--stats",     action="store_true",
                    help="Print statistics to stdout")
    ap.add_argument("--search",    metavar="QUERY",
                    help="Search history non-interactively")
    ap.add_argument("--export",    metavar="FILE", nargs="?", const="",
                    help="Export history as executable shell script")
    # Hook record arguments
    ap.add_argument("--cmd",      metavar="CMD")
    ap.add_argument("--cwd",      metavar="DIR")
    ap.add_argument("--exit",     dest="exit_code", type=int)
    ap.add_argument("--duration", type=int)
    ap.add_argument("--branch",   metavar="BRANCH")
    ap.add_argument("--session",  metavar="SESSION")
    ap.add_argument("--output",   metavar="FILE",
                    help="File with captured output to attach")

    args = ap.parse_args()

    if args.install:
        install_hooks(args.install, os.path.abspath(__file__))
        return

    if args.do_import:
        print("Importing shell history…")
        n = import_history(verbose=True)
        print(f"Done. {n:,} new entries added to {DB_PATH}")
        return

    if args.record:
        if not args.cmd:
            return
        head = None
        if args.output:
            try:
                head = Path(args.output).read_text(errors="replace")[:2000]
            except Exception:
                pass
        record_command(args.cmd, args.cwd, args.exit_code, args.duration,
                       args.branch, args.session, head)
        return

    if args.stats:
        cmd_stats_print()
        return

    if args.search:
        cmd_search_print(args.search)
        return

    if args.export is not None:
        cmd_export_print(args.export or None)
        return

    # ── Interactive TUI ──────────────────────────────────────────────────────
    conn  = get_db()
    count = conn.execute("SELECT COUNT(*) FROM commands").fetchone()[0]
    conn.close()

    if count == 0:
        print("First run — importing shell history…", flush=True)
        n = import_history(verbose=True)
        if n == 0:
            print("  (no history files found — run commands and re-open to populate)")
        else:
            print(f"Imported {n:,} commands. Starting HistView…\n", flush=True)
        time.sleep(0.8)

    HistViewTUI().run()


if __name__ == "__main__":
    main()
