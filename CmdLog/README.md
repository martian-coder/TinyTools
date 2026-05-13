<p align="center">
  <img src="./hero.png" alt="CmdLog Banner" width="100%">
</p>

# CmdLog — Terminal History Viewer

> No more *"what was that command..."* moments.

CmdLog makes your shell history **actually useful** — a rich TUI browser with search, categorization, timelines, bookmarks, analytics, and shell hooks that capture exactly where and when each command ran.

---

## The Problem

`history` gives you a wall of numbers with zero context:

```
 1042  docker-compose up -d
 1043  npm install
 1044  git commit -m "feat: add login"
 1045  curl http://localhost:3000/health
```

No timestamps. No directory. No branch. No idea what it did. No way to find that one command from three weeks ago without `Ctrl+R` prayer.

---

## The Solution

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ CmdLog  [T]imeline  [S]tats  [B]ookmarks  [?]Help                        ║
║   /search  [↑↓/jk] navigate  [Y] copy  [R] re-run  [B] bookmark  [q] quit  ║
║─────────────────────────────────────────────────────────────────────────────║
║ Today                          │ ↔  Command                                 ║
║  ✓ ↔  git commit -m "feat:..  │  git commit -m "feat: add login"           ║
║  ✓ ⬡  docker-compose up -d   │                                             ║
║  ✓ ⬡  npm install             │ ── Metadata ───────────────────────────    ║
║  ✗ ⬡  python3 manage.py run.. │  When      Today 14:23                     ║
║ Yesterday                      │  Where     ~/projects/myapp                ║
║  ✓ ▤  ls -la                  │  Branch    main                            ║
║  ✓ ⊕  curl .../health         │  Took      0.3s                            ║
║  ✓ ✎  vim README.md           │  Status    ✓ success                       ║
║  ✓ ⛵  kubectl get pods        │  Category  ↔ git                           ║
║                                │  Frequency run 12× total                  ║
║                                │                                             ║
║                                │ ── Actions ────────────────────────────    ║
║                                │  [Y] copy   [R] re-run   [D] delete       ║
║                                │  [b] bookmark  [N] note  [E] export       ║
║────────────────────────────────────────────────────────────────────────────║
║ 1,234 cmds · 42 sessions · 87 days  git(38%)  docker(15%)  npm(12%)        ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Works immediately** | Reads `.bash_history`, `.zsh_history`, and Fish history on first launch |
| **Rich shell hooks** | Captures directory, git branch, exit code, and timing for every command |
| **Auto-categorization** | Detects git, docker, npm, python, k8s, db, network, file ops, and more |
| **Live fuzzy search** | Press `/` and type — results filter instantly across all fields |
| **Timeline view** | Commands grouped by Today / Yesterday / day-of-week / month |
| **Stats & analytics** | Category breakdown, hourly heatmap, top commands, failure rate |
| **Bookmarks** | Star important commands, filter to bookmarks view with `Shift+B` |
| **Output capture** | Press `R` to re-run a command — output is captured and stored |
| **Notes** | Press `N` to annotate any command with a plain-text note |
| **Category filter** | Press `C` to filter to the same category as the selected command |
| **Export** | Press `E` to export the current filtered view as a runnable `.sh` script |
| **Zero dependencies** | Pure Python 3 stdlib — no pip installs |
| **Cross-platform** | Works on Linux, macOS, and Windows (PowerShell) |

---

## Quick Start

```bash
# Run immediately — auto-imports your existing history
python3 cmdlog.py

# Then install hooks for richer metadata going forward:
python3 cmdlog.py --install bash      # or: zsh | fish | pwsh
source ~/.bashrc                        # reload shell
```

From then on, every command you run gets recorded with its directory, git branch, exit code, and duration.

---

## Keyboard Reference

| Key | Action |
|-----|--------|
| `↑` / `↓` or `j` / `k` | Navigate the list |
| `Page Up` / `Page Down` | Jump 10 rows |
| `g` / `G` | Jump to top / bottom |
| `/` | Enter live search mode |
| `ESC` | Clear search / filter / go back |
| `Y` or `Enter` | Copy selected command to clipboard |
| `R` | Re-run command and capture output |
| `b` | Toggle bookmark (★) |
| `N` | Add / edit a note |
| `C` | Filter by category of current selection |
| `D` | Delete entry from history |
| `E` | Export filtered list as executable shell script |
| `T` | Timeline view (default) |
| `S` | Stats & analytics view |
| `Shift+B` | Bookmarks view |
| `?` | Help screen |
| `q` / `Ctrl+C` | Quit |

---

## Shell Hook Details

The hooks capture:

- **Command text** — exactly what you typed
- **Working directory** — where you were when you ran it
- **Git branch** — if inside a repo
- **Exit code** — success (`0`) or failure (non-zero)
- **Duration** — how long it took in milliseconds
- **Session ID** — which terminal session it came from

The hooks run **asynchronously** (backgrounded) so they add zero latency to your prompt.

### Bash / Zsh
```bash
python3 cmdlog.py --install bash   # appends to ~/.bashrc
python3 cmdlog.py --install zsh    # appends to ~/.zshrc
```

### Fish
```bash
python3 cmdlog.py --install fish   # writes ~/.config/fish/conf.d/histview.fish
```

### PowerShell
```powershell
python3 cmdlog.py --install pwsh   # appends to $PROFILE
```

---

## CLI Reference

```bash
python3 cmdlog.py                    # Interactive TUI (imports history on first run)
python3 cmdlog.py --import           # Re-import shell history files
python3 cmdlog.py --stats            # Print statistics to stdout
python3 cmdlog.py --search QUERY     # Non-interactive search
python3 cmdlog.py --export           # Export all history as ~/cmdlog_export_*.sh
python3 cmdlog.py --export FILE.sh   # Export to a specific path
python3 cmdlog.py --install SHELL    # Install shell hooks (bash/zsh/fish/pwsh)
```

---

## Data Storage

History is stored in an SQLite database at:

```
~/.local/share/cmdlog/cmdlog.db
```

Schema: `id, cmd, ts, cwd, git_branch, exit_code, duration_ms, session_id, category, bookmarked, note, output_head, source`

No data is ever sent anywhere. Everything stays local.

---

## Requirements

- Python 3.8+
- A terminal with ANSI color support (any modern terminal)
- Optional: `xclip` / `xsel` / `wl-copy` on Linux for clipboard support

---

## License

[MIT](../LICENSE)
