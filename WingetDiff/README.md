# 📊 WingetDiff

> Beautiful terminal diff for `winget export` JSON files — see exactly what's different between two machines in one glance.

Compare your laptop and desktop, before and after a fresh install, or track package drift across environments.

---

## ✨ Features

- 🎨 **Gorgeous ANSI terminal UI** — Rich colors, animated spinners, typewriter effect
- 🔍 **Smart diffing** — Version mismatches, missing packages, additions
- 🚀 **Actionable sync commands** — Generates ready-to-run `winget install/upgrade/uninstall` commands
- 📦 **Zero dependencies** — Pure .NET 8, no NuGet packages, just `System.Text.Json`

---

## 🚀 Usage

```bash
# Export your packages first
winget export -o laptop.json
winget export -o desktop.json

# Run the diff
dotnet run -- laptop.json desktop.json
```

### Output

The tool produces a color-coded table showing:

| Section | Color | Meaning |
|---------|-------|---------|
| **Version Mismatches** | 🟠 Orange | Same package, different versions |
| **Only in File 1** | 🔴 Red | Package exists on source but not target |
| **Only in File 2** | 🟢 Green | Package exists on target but not source |

Plus a **summary** with exact counts and **copy-paste sync commands**:

```
winget upgrade Microsoft.VisualStudioCode --version 1.96.0
winget install Discord.Discord --version 0.0.309
winget uninstall Valve.Steam
```

---

## 🏗️ Architecture

Single-file design — everything lives in `Program.cs`:

```
Program.cs
├── CLI argument parsing + file validation
├── JSON deserialization (winget export format)
├── Four-way diff logic (mismatch / only-in-1 / only-in-2 / in-sync)
├── ANSI table renderer with color coding
├── Sync command generator
└── Animation engine (spinner + typewriter)
```

**Zero external dependencies.** Just `System.Text.Json` from the BCL.

---

## 🔧 Requirements

- Windows / macOS / Linux (any terminal with ANSI support)
- .NET 8 SDK

---

## 📄 License

[MIT](../LICENSE)
