# 📦 MarkdownZipped

> Compress LLM prompts through a four-stage pipeline and pack them into a `.mdz` file.

When your Claude / GPT / Gemini bill is mostly the same system prompt resent on every call, you're paying for tokens you could have stripped, rewritten, deduplicated, or cached. `mdzip` does all four, in one pass, with zero dependencies.

---

## ✨ The Pipeline

| Stage | What it does | Typical savings |
|-------|--------------|-----------------|
| **1. format**     | Strips whitespace, converts XML/JSON to flat minified Markdown | 10–30% |
| **2. linguistic** | Regex rewrite of filler ("it is important to", "kindly", hedges) | 15–25% |
| **3. semantic**   | Drops near-duplicate bullets and sentences (Jaccard on n-grams) | 20–40% |
| **4. cache**      | Splits static vs dynamic, emits cache plan + cost estimate | 80–90% on repeat calls |

The big lever is stage 4 — prompt caching is the single largest cost reduction available on any major LLM API. Stages 1–3 make the cacheable block smaller so the read cost is smaller too.

---

## 🚀 Quick Start

### 🌐 Web app

**Live:** `https://martian-coder.github.io/tinytools/` *(after Pages is enabled — see below)*

```bash
# Or run it locally — pure static file, zero backend
open web/index.html         # macOS
xdg-open web/index.html     # Linux
start web/index.html        # Windows
```

The web UI ports the full pipeline to JavaScript so it runs offline in any modern browser. Paste a prompt, see live token counts per stage, tune the dedup threshold and cache parameters, then download a `.mdz`. The heuristic path produces byte-identical output to the Python CLI.

**Token counting — two modes:**

| Mode | Speed | Accuracy | Needs |
|------|-------|----------|-------|
| **Heuristic** (default) | instant, offline | ~5% of real tokenizer on prose | nothing |
| **Anthropic API** | live | exact, model-accurate | your own API key |

Pick a model (Opus / Sonnet / Haiku) and paste your Anthropic key in the **Token counting** bar. The key is stored in this browser's `localStorage` only, is never logged, and is sent **only** in direct HTTPS calls to `api.anthropic.com` (`/v1/messages/count_tokens`). Counts are cached per `(model, text)` so identical text isn't re-billed. Clear the key any time with one click. Prices shown are a dated static reference (no public pricing API exists); token *counts* are pulled live.

**Going live on GitHub Pages:** a workflow at `.github/workflows/pages.yml` deploys `web/` automatically. One manual step that cannot be scripted: in the repo, **Settings → Pages → Build and deployment → Source: "GitHub Actions"**. After that, every push that touches the web app redeploys.

### 🐍 Python CLI

```bash
# Compress a verbose prompt
python3 mdzip.py zip examples/verbose_prompt.xml

# Read it back
python3 mdzip.py unzip examples/verbose_prompt.mdz

# Stats only
python3 mdzip.py info examples/verbose_prompt.mdz

# Pipe in anything
cat my_system_prompt.md | python3 mdzip.py zip -o system.mdz
```

Output of the example:

```
compression report
------------------
original  :    399 tok
compressed:    235 tok  (+41.1%)

per-stage:
  format         399 ->    299 tok (+25.1%)
  linguistic     299 ->    235 tok (+21.4%)
  semantic       235 ->    235 tok (+0.0%)

cache plan : static=225 tok, dynamic=3 tok, cacheable=True
@ 1000 calls: $0.68 -> $0.08  (+88.7%)
```

---

## 📄 The `.mdz` Format

A `.mdz` file is human-readable text (open it in any editor). It has a small header block, a `---static---` section that the model should cache, and an optional `---dynamic---` section that changes per call.

```
---mdz v1---
tokens: 235
original_tokens: 399
reduction_pct: 41.1
cache_ttl: 5m
cacheable: true
savings_pct_1k_calls: 88.7
---static---
# System Prompt
You are a helpful assistant. Be concise and direct.
- Use bullets regularly.
- Avoid hedging or vague language.
---dynamic---
{user_message}
---end---
```

To mark where the cacheable static block ends and the per-call dynamic content starts, put `<<<USER_INPUT>>>` in your source file:

```
You are a helpful assistant.
... lots of stable instructions ...

<<<USER_INPUT>>>
{question}
```

Everything above the sentinel gets compressed and cached. Everything below passes through untouched.

---

## 🛠️ CLI Reference

```
mdzip zip [input] [options]
  -o, --output PATH        write to PATH (default: <input>.mdz)
  --aggressive             also strip hedges (very, really, just, simply, ...)
  --no-format              skip stage 1
  --no-linguistic          skip stage 2
  --no-semantic            skip stage 3
  --no-cache               skip stage 4
  --threshold FLOAT        Jaccard dedup threshold (default 0.75)
  --ttl 5m|1h              cache TTL (default 5m)
  --min-cache-tokens N     minimum static size to cache (default 1024)
  --calls N                projected call count for savings (default 1000)
  --report-only            print report only; don't write file

mdzip unzip <file.mdz>     print contents (use --headers for header block)
mdzip info  <file.mdz>     show stats
mdzip version              print version
```

If `input` is omitted or `-`, mdzip reads from stdin.

---

## 🐍 Use as a Library

```python
from mdzip import compress, write_mdz
from pathlib import Path

result = compress(open("prompt.md").read(), aggressive=True)
print(result.report())
write_mdz(Path("prompt.mdz"), result)

# Stage toggles
result = compress(text, linguistic=False, semantic=False)

# Just the cache plan
print(result.plan.savings(n_calls=10_000))
```

---

## 🏗️ Architecture

```
mdzip.py             — Python CLI + library (single file, stdlib only)
├── count_tokens()         — heuristic tokenizer (~5% of tiktoken on prose)
├── stage1_format()        — XML/JSON/Markdown normalizer
├── stage2_linguistic()    — regex filler/verbose-phrase rewriter
├── stage3_semantic()      — Jaccard n-gram dedup
├── stage4_cache()         — sentinel split + CachePlan with cost model
├── compress()             — orchestrator, per-stage token deltas
├── write_mdz / read_mdz   — .mdz container codec
└── main()                 — argparse CLI (zip / unzip / info / version)

web/index.html       — production web app (single file, no build, no backend)
├── pipeline.js (inlined)  — JS port of all 4 stages, byte-identical output
├── 3-panel studio UI      — input · live output · before/after diff
├── pipeline tabs          — click a stage to view its intermediate result
├── cost calculator        — live $ estimate vs. call volume + model
└── .mdz download          — saves the compressed container locally
```

Everything is one Python file and one HTML file. No package layout, no `pyproject.toml`, no `npm install`, no backend. Both the CLI and the web app are pure standard library / browser-native.

---

## 🧪 Design Notes

**Why regex for stage 2 and not an LLM rewrite?** Because stage 2 should be free, instant, and deterministic. If you want smarter rewrites, run a cheap model (Haiku) once over the static block and cache the result — one rewrite pays for itself after ~5 subsequent calls.

**Why Jaccard for stage 3 and not embeddings?** Embeddings need a network call and an API key. Character n-gram Jaccard catches the high-precision case (restated bullets, paraphrased examples) without any dependency. If you need deep semantic dedup, swap the `_shingles` function for an embedding lookup — the rest of the structure stays.

**Why a text format for `.mdz` and not gzip?** Because the value isn't bytes-on-disk — it's tokens-in-context. A `.mdz` should be diff-able, grep-able, and reviewable in PRs. If you really need bytes-on-disk savings, pipe through `gzip` after.

**Token counts are a heuristic.** For production billing forecasts, run your output through `tiktoken` or the Anthropic token-count endpoint. The built-in counter is calibrated for prose to within ~5% of `o200k_base` but isn't model-aware.

---

## 🔧 Requirements

- Python 3.8+
- No external packages

---

## 📄 License

[MIT](../LICENSE)
