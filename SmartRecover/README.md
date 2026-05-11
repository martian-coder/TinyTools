# 🛟 SmartRecover

> When your machine crashes, freezes or hangs — pick up exactly where you left off.

SmartRecover quietly snapshots your terminals, tmux sessions, browser tabs, clipboard and shell history every few minutes. After a crash or reboot, scrub back through the timeline in a TUI and restore what you lost.

Zero dependencies. Single file. Pure Python stdlib.

---

## ✨ What it captures

| Layer | What gets saved |
|-------|-----------------|
| **tmux** | Every session, window, pane — CWD, running command, last 200 lines of scrollback |
| **Processes** | Open apps + their command line + working directory |
| **Browser tabs** | Firefox tabs (URL + title), Chromium-family session file paths |
| **Windows** | Window positions/sizes/titles (via `wmctrl`, X11 only) |
| **Clipboard** | Current clipboard text (via `wl-paste` / `xclip` / `xsel`) |
| **Shell history** | Last 200 commands from bash, zsh, fish |

All optional. SmartRecover gracefully degrades when helpers aren't installed.

---

## 🚀 Quick start

```bash
# Take one snapshot, right now
python3 smartrecover.py save "before-meeting"

# Browse all snapshots in the TUI
python3 smartrecover.py

# Auto-snapshot every 10 minutes in the background
python3 smartrecover.py daemon &
```

That's it. No config, no setup, no dependencies.

---

## 📺 The TUI

```
 SmartRecover — Pick up where you left off   12 snapshots
────────────────────────────────────────────────────────────────────
 ● 05-11 14:32  before-meeting   │ Snapshot #12  [manual]  before-meeting
 ○ 05-11 14:15  auto             │   2026-05-11 14:32  ·  3m ago
 ○ 05-11 14:00  auto             │
 ● 05-11 12:00  lunch            │ Processes (6)
 ○ 05-11 11:45  auto             │   ▸ code   · ~/projects/backend
 ○ 05-11 11:30  auto             │   ▸ firefox
                                  │   ▸ slack
                                  │
                                  │ tmux (3 sessions, 7 panes)
                                  │   ▸ work
                                  │      · ~/projects/backend  [vim]
                                  │      · ~/projects/backend  [npm]
                                  │   ▸ scratch
                                  │      · /tmp  [bash]
                                  │
                                  │ Browser (12 Firefox tabs)
                                  │   ▸ localhost:3000/dashboard
                                  │   ▸ github.com/user/repo/pull/42
                                  │   ... and 10 more tabs
────────────────────────────────────────────────────────────────────
↑↓ navigate · [s]ave · [r]estore · [t]mux · [b]rowser · [c]lipboard · [/]search · [d]elete · [q]uit
```

---

## 💻 Command reference

```bash
smartrecover                       # launch the TUI
smartrecover save [name]           # take a manual snapshot
smartrecover list                  # list snapshots
smartrecover show <id>             # full details of one snapshot
smartrecover restore <id>          # restore everything from snapshot id
smartrecover restore <id> --tmux   # restore only tmux sessions
smartrecover restore <id> --browser
smartrecover restore <id> --clipboard
smartrecover search "rebase -i"    # grep across every snapshot ever taken
smartrecover daemon --interval 600 # autosaver, every 10 min (default)
smartrecover prune --keep 50       # delete all but newest 50 snapshots
smartrecover where                 # print the SQLite db path
```

Tip: add a shell alias `alias sr='python3 /path/to/smartrecover.py'` so you can just type `sr`.

---

## 🛠️ How restore works

| Layer | What "restore" does |
|-------|---------------------|
| **tmux** | Spins up new tmux sessions (prefixed `sr-`) with original CWDs and pane layout. Attach with `tmux attach -t sr-…` |
| **Browser tabs** | Writes a clickable HTML page with all captured URLs and opens it in your default browser |
| **Clipboard** | Pipes the saved text back into your clipboard via `wl-copy` / `xclip` / `xsel` |
| **Processes** | Not auto-launched (too risky). Shown so you remember what you had open. |

SmartRecover favours *recoverable evidence* over *automated chaos*. It won't relaunch a misbehaving app for you, but it'll show you exactly what was running and where.

---

## 🔁 The crash recovery workflow

```bash
# One-time: start the daemon at login (.bashrc, systemd --user, etc.)
python3 smartrecover.py daemon --interval 300 &

# ...machine crashes / freezes / you reboot...

# After reboot:
smartrecover                        # browse the timeline
                                    # → find the snapshot from just before the crash
                                    # → press r to restore tmux, browser tabs, clipboard
                                    # → done.
```

Or, if you just want to recover one lost thing:

```bash
smartrecover search "the command I lost"
smartrecover search "the URL I had open"
```

---

## 📂 Where things live

```
~/.local/share/smartrecover/
├── smartrecover.db   SQLite — all snapshots + captured data
├── blobs/            (reserved for future binary captures)
└── daemon.lock       PID file when the daemon is running
```

Snapshots are tiny (a few KB each). 1000 snapshots ≈ a few MB.

---

## 🤔 Why not just use tmux-resurrect?

`tmux-resurrect` only saves your latest tmux state, and only tmux. SmartRecover gives you a full **timeline** across tmux + browser + clipboard + shell history, so you can travel back to "3 hours ago, before I closed those tabs."

---

## 📄 License

[MIT](../LICENSE) — same as the rest of TinyTools.
