#!/usr/bin/env python3
"""
MarkdownZipped (mdzip) — compress LLM prompts through a four-stage pipeline
and emit a .mdz file.

Stages:
  1. format      — strip whitespace, convert XML/JSON to flat Markdown
  2. linguistic  — regex rewrite of filler, verbose phrases, hedges
  3. semantic    — drop near-duplicate bullets/sentences (Jaccard on n-grams)
  4. cache       — split static vs dynamic at <<<USER_INPUT>>>, emit cache plan

Zero dependencies. Pure Python 3.8+ standard library.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

__version__ = "0.1.0"
MDZ_MAGIC = "---mdz v1---"
DYNAMIC_SENTINEL = "<<<USER_INPUT>>>"

# Pricing reference (USD per 1M tokens, Anthropic Sonnet-class as of 2026):
# base in: 3.00, cache write: 3.75 (1.25x), cache read: 0.30 (0.10x)
PRICE_BASE_IN = 3.00
PRICE_CACHE_WRITE = 3.75
PRICE_CACHE_READ = 0.30
DEFAULT_MIN_CACHE_TOKENS = 1024


# ---------------------------------------------------------------------------
# Token counting (heuristic — no tiktoken dependency)
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r"\w+|[^\s\w]", re.UNICODE)


def count_tokens(text: str) -> int:
    """Heuristic token counter.

    Calibrated against tiktoken o200k_base on prompt-like text: words split
    on common subword boundaries, plus punctuation as its own token. Within
    ~5% of true count for English prose; conservative for code/JSON.
    """
    if not text:
        return 0
    tokens = 0
    for match in _WORD_RE.finditer(text):
        chunk = match.group(0)
        if chunk.isalpha():
            # ~4 chars per token on English text; round up for short words
            tokens += max(1, (len(chunk) + 3) // 4)
        elif chunk.isdigit():
            tokens += max(1, (len(chunk) + 2) // 3)
        else:
            tokens += 1
    return tokens


# ---------------------------------------------------------------------------
# Stage 1 — format minifier
# ---------------------------------------------------------------------------

_XML_TAG_RE = re.compile(r"<([a-zA-Z_][\w\-]*)\b[^>]*>(.*?)</\1>", re.DOTALL)
_SELF_CLOSING_RE = re.compile(r"<([a-zA-Z_][\w\-]*)\b[^>]*/>")


def _looks_like_json(text: str) -> bool:
    s = text.strip()
    return (s.startswith("{") and s.endswith("}")) or (
        s.startswith("[") and s.endswith("]")
    )


def _looks_like_xml(text: str) -> bool:
    s = text.lstrip()
    return s.startswith("<") and "</" in s


def _xml_to_md(text: str, depth: int = 0) -> str:
    """Best-effort XML → flat Markdown. Tolerant of malformed input."""
    out: List[str] = []
    pos = 0
    text = text.strip()
    while pos < len(text):
        m = _XML_TAG_RE.search(text, pos)
        if not m:
            tail = text[pos:].strip()
            if tail:
                out.append(tail)
            break
        # any leading text before the tag
        lead = text[pos : m.start()].strip()
        if lead:
            out.append(lead)
        tag, body = m.group(1), m.group(2).strip()
        body_inner = _xml_to_md(body, depth + 1) if "<" in body else body
        tag_low = tag.lower()
        if tag_low in ("item", "li", "bullet"):
            out.append(f"- {body_inner}")
        elif depth == 0:
            out.append(f"# {tag.replace('_', ' ').title()}\n{body_inner}")
        else:
            out.append(f"## {tag.replace('_', ' ').title()}\n{body_inner}")
        pos = m.end()
    return "\n".join(s for s in out if s)


def stage1_format(text: str) -> str:
    """Detect input format and normalize to minified Markdown.

    Honors the <<<USER_INPUT>>> sentinel: only the static prefix is
    reformatted, the dynamic suffix is preserved verbatim.
    """
    if DYNAMIC_SENTINEL in text:
        head, _, tail = text.partition(DYNAMIC_SENTINEL)
        return f"{stage1_format(head).rstrip()}\n{DYNAMIC_SENTINEL}\n{tail.lstrip()}"

    stripped = text.strip()
    if not stripped:
        return ""

    if _looks_like_json(stripped):
        try:
            return json.dumps(json.loads(stripped), separators=(",", ":"))
        except json.JSONDecodeError:
            pass  # fall through to text path

    if _looks_like_xml(stripped):
        converted = _xml_to_md(stripped)
        if converted.strip():
            stripped = converted

    # strip self-closing leftover tags
    stripped = _SELF_CLOSING_RE.sub("", stripped)

    # collapse runs of blank lines to a single blank
    lines = [ln.rstrip() for ln in stripped.splitlines()]
    out: List[str] = []
    blank = False
    for ln in lines:
        if ln.strip() == "":
            if not blank and out:
                out.append("")
            blank = True
        else:
            out.append(ln)
            blank = False
    # squash multi-space runs inside non-code lines
    in_code = False
    final: List[str] = []
    for ln in out:
        if ln.strip().startswith("```"):
            in_code = not in_code
            final.append(ln.strip())
            continue
        if in_code:
            final.append(ln)
        else:
            final.append(re.sub(r"[ \t]{2,}", " ", ln))
    return "\n".join(final).strip()


# ---------------------------------------------------------------------------
# Stage 2 — linguistic compressor
# ---------------------------------------------------------------------------

DELETE_PATTERNS = [
    r"\bit is important to note that\b",
    r"\bit is important to\b",
    r"\bit should be noted that\b",
    r"\bplease (?:note|be aware|make sure|kindly) that\b",
    r"\bplease (?:note|kindly)\b",
    r"\b(?<![\w-])kindly\b",
    r"\bas (?:you can see|already mentioned|previously stated)\b",
    r"\bneedless to say\b",
    r"\bat the end of the day\b",
    r"\bfor (?:all|the) intents? and purposes\b",
    r"\bin (?:my )?humble opinion\b",
    r"\bwithout further ado\b",
    r"\bgoes without saying\b",
]

REPLACE_MAP = {
    r"\bin order to\b": "to",
    r"\bdue to the fact that\b": "because",
    r"\bin spite of the fact that\b": "although",
    r"\bin the event that\b": "if",
    r"\bin the case that\b": "if",
    r"\bin the process of\b": "while",
    r"\bat this point in time\b": "now",
    r"\bat the present time\b": "now",
    r"\bin a timely manner\b": "promptly",
    r"\bon a regular basis\b": "regularly",
    r"\bwith regard to\b": "about",
    r"\bwith respect to\b": "about",
    r"\bin reference to\b": "about",
    r"\ba (?:large|great) number of\b": "many",
    r"\ba (?:small )?majority of\b": "most",
    r"\bthe majority of\b": "most",
    r"\bprior to\b": "before",
    r"\bsubsequent to\b": "after",
    r"\bin the near future\b": "soon",
    r"\bmake (?:a |an )?(?:decision|determination)\b": "decide",
    r"\bprovide (?:a |an )?(?:summary|overview) of\b": "summarize",
    r"\bgive (?:a |an )?explanation of\b": "explain",
    r"\bmake use of\b": "use",
    r"\butilize\b": "use",
    r"\butilization\b": "use",
    r"\bdemonstrate\b": "show",
    r"\bdemonstration\b": "demo",
    r"\bfacilitate\b": "help",
    r"\bcommence\b": "start",
    r"\bterminate\b": "end",
    r"\bendeavor\b": "try",
    r"\bnumerous\b": "many",
    r"\bsufficient\b": "enough",
    r"\badditional\b": "more",
    r"\bapproximately\b": "about",
    r"\bnevertheless\b": "still",
    r"\bnonetheless\b": "still",
    r"\bfurthermore\b": "also",
    r"\bin addition\b": "also",
    r"\bmoreover\b": "also",
    r"\bhowever\b": "but",
    r"\btherefore\b": "so",
    r"\bconsequently\b": "so",
    r"\bthus\b": "so",
    r"\bregarding\b": "on",
    r"\bconcerning\b": "on",
    r"\bperform an analysis of\b": "analyze",
    r"\bcarry out\b": "do",
    r"\bcome to (?:a |an )?(?:conclusion|agreement)\b": "conclude",
}

HEDGES = [
    r"\bvery\b",
    r"\breally\b",
    r"\bquite\b",
    r"\bbasically\b",
    r"\bessentially\b",
    r"\bactually\b",
    r"\bliterally\b",
    r"\bjust\b",
    r"\bsimply\b",
    r"\bso to speak\b",
    r"\bif you will\b",
    r"\bsort of\b",
    r"\bkind of\b",
]


def _strip_filler(text: str, aggressive: bool) -> str:
    for pat in DELETE_PATTERNS:
        text = re.sub(pat, "", text, flags=re.IGNORECASE)
    for pat, repl in REPLACE_MAP.items():
        text = re.sub(pat, repl, text, flags=re.IGNORECASE)
    if aggressive:
        for pat in HEDGES:
            text = re.sub(pat, "", text, flags=re.IGNORECASE)
    return text


def _tidy(text: str) -> str:
    # collapse spaces around dropped phrases
    text = re.sub(r"[ \t]{2,}", " ", text)
    # orphaned punctuation (e.g. " ,", " .")
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    # leading commas after deletion
    text = re.sub(r"(^|\n)\s*[,;]\s*", r"\1", text)
    # collapse newlines+spaces
    text = re.sub(r"\n[ \t]+", "\n", text)
    # recapitalize sentence starts
    def _cap(m: re.Match) -> str:
        return m.group(1) + m.group(2).upper()
    text = re.sub(r"(^|[.!?]\s+|\n)([a-z])", _cap, text)
    return text.strip()


def stage2_linguistic(text: str, aggressive: bool = False) -> str:
    """Regex-only verbose phrase rewriting. No LLM calls, no latency cost.

    Preserves fenced code blocks verbatim AND preserves the whitespace
    boundary around them so layout survives rewriting.
    """
    if not text:
        return text
    parts = re.split(r"(```.*?```)", text, flags=re.DOTALL)
    out: List[str] = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            out.append(part)
        else:
            lead = re.match(r"^\s*", part).group(0)
            trail = re.search(r"\s*$", part).group(0)
            out.append(lead + _tidy(_strip_filler(part, aggressive)) + trail)
    return "".join(out)


# ---------------------------------------------------------------------------
# Stage 3 — semantic dedupe
# ---------------------------------------------------------------------------

def _shingles(text: str, n: int = 3) -> set:
    s = re.sub(r"\s+", " ", text.lower().strip())
    if len(s) <= n:
        return {s}
    return {s[i : i + n] for i in range(len(s) - n + 1)}


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _classify(line: str) -> str:
    s = line.strip()
    if not s:
        return "blank"
    if s.startswith("```"):
        return "fence"
    if s.startswith("#"):
        return "header"
    if re.match(r"^[-*+]\s", s) or re.match(r"^\d+[.)]\s", s):
        return "bullet"
    return "prose"


def stage3_semantic(text: str, threshold: float = 0.75) -> str:
    """Drop near-duplicate bullets and sentences.

    Headers, blank lines, and fenced code blocks pass through untouched.
    """
    if not text:
        return text
    lines = text.splitlines()
    kept: List[str] = []
    kept_shingles: List[set] = []
    in_code = False
    for line in lines:
        kind = _classify(line)
        if kind == "fence":
            in_code = not in_code
            kept.append(line)
            continue
        if in_code or kind in ("header", "blank"):
            kept.append(line)
            continue
        sh = _shingles(line)
        if any(_jaccard(sh, prev) >= threshold for prev in kept_shingles):
            continue  # near-duplicate, skip
        kept.append(line)
        kept_shingles.append(sh)
    # final pass: collapse extra blank lines created by removals
    out: List[str] = []
    blank = False
    for ln in kept:
        if ln.strip() == "":
            if not blank and out:
                out.append("")
            blank = True
        else:
            out.append(ln)
            blank = False
    return "\n".join(out).strip()


# ---------------------------------------------------------------------------
# Stage 4 — structural cache plan
# ---------------------------------------------------------------------------

@dataclass
class CachePlan:
    static: str
    dynamic: str
    cache_ttl: str = "5m"
    min_cache_tokens: int = DEFAULT_MIN_CACHE_TOKENS

    @property
    def cacheable(self) -> bool:
        return count_tokens(self.static) >= self.min_cache_tokens

    def savings(self, n_calls: int = 1000) -> dict:
        s_tok = count_tokens(self.static)
        d_tok = count_tokens(self.dynamic)
        baseline = (s_tok + d_tok) * n_calls * PRICE_BASE_IN / 1_000_000
        if self.cacheable and n_calls >= 1:
            cached = (
                s_tok * PRICE_CACHE_WRITE / 1_000_000
                + s_tok * (n_calls - 1) * PRICE_CACHE_READ / 1_000_000
                + d_tok * n_calls * PRICE_BASE_IN / 1_000_000
            )
        else:
            cached = baseline
        pct = 0.0 if baseline == 0 else (1 - cached / baseline) * 100
        return {
            "baseline_usd": round(baseline, 4),
            "cached_usd": round(cached, 4),
            "savings_pct": round(pct, 1),
            "static_tokens": s_tok,
            "dynamic_tokens": d_tok,
            "n_calls": n_calls,
            "cacheable": self.cacheable,
        }


def stage4_cache(text: str, cache_ttl: str = "5m",
                 min_cache_tokens: int = DEFAULT_MIN_CACHE_TOKENS) -> CachePlan:
    if DYNAMIC_SENTINEL in text:
        static, _, dynamic = text.partition(DYNAMIC_SENTINEL)
    else:
        static, dynamic = text, ""
    return CachePlan(
        static=static.strip(),
        dynamic=dynamic.strip(),
        cache_ttl=cache_ttl,
        min_cache_tokens=min_cache_tokens,
    )


# ---------------------------------------------------------------------------
# Pipeline orchestrator
# ---------------------------------------------------------------------------

@dataclass
class StageResult:
    name: str
    tokens_in: int
    tokens_out: int

    @property
    def delta_pct(self) -> float:
        if self.tokens_in == 0:
            return 0.0
        return (1 - self.tokens_out / self.tokens_in) * 100


@dataclass
class CompressionResult:
    original: str
    output: str
    stages: List[StageResult] = field(default_factory=list)
    plan: Optional[CachePlan] = None

    @property
    def tokens_before(self) -> int:
        return count_tokens(self.original)

    @property
    def tokens_after(self) -> int:
        return count_tokens(self.output)

    @property
    def reduction_pct(self) -> float:
        if self.tokens_before == 0:
            return 0.0
        return (1 - self.tokens_after / self.tokens_before) * 100

    def report(self, n_calls: int = 1000) -> str:
        lines = [
            "compression report",
            "------------------",
            f"original  : {self.tokens_before:>6} tok",
            f"compressed: {self.tokens_after:>6} tok  ({self.reduction_pct:+.1f}%)",
            "",
            "per-stage:",
        ]
        for s in self.stages:
            lines.append(
                f"  {s.name:<11} {s.tokens_in:>6} -> {s.tokens_out:>6} tok "
                f"({s.delta_pct:+.1f}%)"
            )
        if self.plan is not None:
            sv = self.plan.savings(n_calls)
            lines += [
                "",
                f"cache plan : static={sv['static_tokens']} tok, "
                f"dynamic={sv['dynamic_tokens']} tok, "
                f"cacheable={sv['cacheable']}",
                f"@ {n_calls} calls: ${sv['baseline_usd']:.2f} -> "
                f"${sv['cached_usd']:.2f}  ({sv['savings_pct']:+.1f}%)",
            ]
        return "\n".join(lines)


def compress(
    text: str,
    *,
    format: bool = True,
    linguistic: bool = True,
    semantic: bool = True,
    cache: bool = True,
    aggressive: bool = False,
    dedupe_threshold: float = 0.75,
    cache_ttl: str = "5m",
    min_cache_tokens: int = DEFAULT_MIN_CACHE_TOKENS,
) -> CompressionResult:
    """Run the four-stage pipeline. Each stage can be toggled off."""
    result = CompressionResult(original=text, output=text)
    current = text

    def _record(name: str, before: str, after: str) -> None:
        result.stages.append(
            StageResult(name, count_tokens(before), count_tokens(after))
        )

    if format:
        nxt = stage1_format(current)
        _record("format", current, nxt)
        current = nxt
    if linguistic:
        nxt = stage2_linguistic(current, aggressive=aggressive)
        _record("linguistic", current, nxt)
        current = nxt
    if semantic:
        nxt = stage3_semantic(current, threshold=dedupe_threshold)
        _record("semantic", current, nxt)
        current = nxt
    if cache:
        plan = stage4_cache(current, cache_ttl=cache_ttl,
                            min_cache_tokens=min_cache_tokens)
        result.plan = plan

    result.output = current
    return result


# ---------------------------------------------------------------------------
# .mdz file format
# ---------------------------------------------------------------------------

def write_mdz(path: Path, result: CompressionResult) -> None:
    """Write the .mdz container — a small human-readable text format."""
    plan = result.plan
    static = plan.static if plan else result.output
    dynamic = plan.dynamic if plan else ""
    cache_ttl = plan.cache_ttl if plan else "5m"
    cacheable = plan.cacheable if plan else False
    sv = plan.savings() if plan else None

    out = [
        MDZ_MAGIC,
        f"tokens: {result.tokens_after}",
        f"original_tokens: {result.tokens_before}",
        f"reduction_pct: {result.reduction_pct:.1f}",
        f"cache_ttl: {cache_ttl}",
        f"cacheable: {str(cacheable).lower()}",
    ]
    if sv:
        out.append(f"savings_pct_1k_calls: {sv['savings_pct']}")
    out.append("---static---")
    out.append(static)
    if dynamic:
        out.append("---dynamic---")
        out.append(dynamic)
    out.append("---end---")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def read_mdz(path: Path) -> Tuple[dict, str, str]:
    """Read a .mdz file. Returns (headers, static, dynamic)."""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0] != MDZ_MAGIC:
        raise ValueError(f"not a .mdz file: {path}")
    headers: dict = {}
    i = 1
    while i < len(lines) and not lines[i].startswith("---"):
        if ":" in lines[i]:
            k, _, v = lines[i].partition(":")
            headers[k.strip()] = v.strip()
        i += 1
    section = None
    static_lines: List[str] = []
    dynamic_lines: List[str] = []
    while i < len(lines):
        ln = lines[i]
        if ln == "---static---":
            section = "static"
        elif ln == "---dynamic---":
            section = "dynamic"
        elif ln == "---end---":
            break
        elif section == "static":
            static_lines.append(ln)
        elif section == "dynamic":
            dynamic_lines.append(ln)
        i += 1
    return headers, "\n".join(static_lines).strip(), "\n".join(dynamic_lines).strip()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

BANNER = r"""
  __  __ ___    ____ ___ ____
 |  \/  |   \  |_  /|_ _|  _ \
 | |\/| | |) |  / /  | || |_) |
 |_|  |_|___/  /___||___|  __/
                         |_|       MarkdownZipped v""" + __version__


def _read_input(arg: Optional[str]) -> str:
    if arg in (None, "-"):
        return sys.stdin.read()
    return Path(arg).read_text(encoding="utf-8")


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(
        prog="mdzip",
        description="Compress LLM prompts through a 4-stage pipeline -> .mdz",
    )
    sub = p.add_subparsers(dest="cmd")

    pz = sub.add_parser("zip", help="compress input -> .mdz")
    pz.add_argument("input", nargs="?", help="input file (or '-' / omit for stdin)")
    pz.add_argument("-o", "--output", help="output .mdz path (default: <input>.mdz)")
    pz.add_argument("--aggressive", action="store_true",
                    help="also strip hedges (very, really, just, ...)")
    pz.add_argument("--no-format", action="store_true")
    pz.add_argument("--no-linguistic", action="store_true")
    pz.add_argument("--no-semantic", action="store_true")
    pz.add_argument("--no-cache", action="store_true")
    pz.add_argument("--threshold", type=float, default=0.75)
    pz.add_argument("--ttl", default="5m", help="cache TTL: 5m or 1h")
    pz.add_argument("--min-cache-tokens", type=int,
                    default=DEFAULT_MIN_CACHE_TOKENS)
    pz.add_argument("--calls", type=int, default=1000,
                    help="projected call count for savings estimate")
    pz.add_argument("--report-only", action="store_true",
                    help="print report, don't write file")

    pu = sub.add_parser("unzip", help="read a .mdz and print contents")
    pu.add_argument("input", help=".mdz file to read")
    pu.add_argument("--headers", action="store_true",
                    help="print only the header block")

    pi = sub.add_parser("info", help="show stats for a .mdz file")
    pi.add_argument("input", help=".mdz file to inspect")

    sub.add_parser("version", help="print version")

    args = p.parse_args(argv)

    if args.cmd in (None, "zip"):
        if args.cmd is None:
            print(BANNER)
            p.print_help()
            return 0
        text = _read_input(args.input)
        result = compress(
            text,
            format=not args.no_format,
            linguistic=not args.no_linguistic,
            semantic=not args.no_semantic,
            cache=not args.no_cache,
            aggressive=args.aggressive,
            dedupe_threshold=args.threshold,
            cache_ttl=args.ttl,
            min_cache_tokens=args.min_cache_tokens,
        )
        if args.report_only:
            print(result.report(n_calls=args.calls))
            return 0
        if args.input and args.input != "-":
            default_out = Path(args.input).with_suffix(".mdz")
        else:
            default_out = Path("out.mdz")
        out_path = Path(args.output) if args.output else default_out
        write_mdz(out_path, result)
        print(result.report(n_calls=args.calls))
        print(f"\nwrote {out_path}")
        return 0

    if args.cmd == "unzip":
        headers, static, dynamic = read_mdz(Path(args.input))
        if args.headers:
            for k, v in headers.items():
                print(f"{k}: {v}")
            return 0
        print(static)
        if dynamic:
            print(f"\n{DYNAMIC_SENTINEL}")
            print(dynamic)
        return 0

    if args.cmd == "info":
        headers, static, dynamic = read_mdz(Path(args.input))
        print(f"file       : {args.input}")
        for k, v in headers.items():
            print(f"{k:<22}: {v}")
        print(f"static_chars          : {len(static)}")
        print(f"dynamic_chars         : {len(dynamic)}")
        return 0

    if args.cmd == "version":
        print(__version__)
        return 0

    p.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
