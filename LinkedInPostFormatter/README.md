# LinkedIn Post Formatter

Write a LinkedIn post, style it, and paste it in knowing it will look exactly the way it looked
in the editor.

**Live:** https://martian-coder.github.io/TinyTools/linkedin/

## Why pasting normally breaks

LinkedIn feed posts accept plain text only. There is no HTML, no Markdown, and no rich-text
support — that only exists in Articles and Newsletters. So when you write a post in Google Docs
or Word and paste it into the feed composer, LinkedIn discards every formatting instruction and
you get a flat wall of text.

This tool sidesteps that entirely. Instead of sending formatting *alongside* the text, it swaps
the letters themselves for characters from Unicode's Mathematical Alphanumeric Symbols block —
`H` becomes `𝗛`, which is a different character that happens to look bold. There is nothing for
LinkedIn to strip, because as far as LinkedIn is concerned it is receiving ordinary text.

The copy button writes `text/plain` only, for the same reason.

## What it does

**Ten styles** — bold, italic, bold italic, serif bold, underline, strikethrough, monospace,
script, outline, and fullwidth. Select text, click a button. Each button is rendered in the style
it applies, so there is nothing to memorise.

**A preview that matches reality.** Mobile and desktop widths, light and dark mode, and the
"…see more" cut placed where LinkedIn actually places it. Hashtags and links render blue *only
when they are plain characters* — which is exactly what LinkedIn does, and it makes one of the
tool's most important warnings visible rather than theoretical.

**Checks that catch what other formatters don't:**

| Check | Why it matters |
|---|---|
| Character count | Styled characters cost two against the 3,000 limit, so a post that looks short gets rejected |
| Styled hashtags and links | LinkedIn matches literal characters — a styled hashtag is dead, and a styled URL is not clickable |
| Styling ratio | Screen readers read these characters as Unicode names, not words |
| Blank-line runs | LinkedIn collapses three or more, so editor spacing is not published spacing |
| Paragraph length | Anything past four rendered mobile lines reads as a wall |
| Hook length | Mobile truncates around 140 characters, often mid-sentence |
| Emoji count | Engagement flattens after two or three |

**Templates** — six post structures and a set of opening lines. They are shapes, not scripts;
every word is meant to be replaced.

**Drafts** saved to your browser. Nothing is uploaded — there is no backend, no account, and no
analytics. The whole app is static files.

## The trade-off, stated plainly

Styled characters are not letters. Two things follow, and neither is fixable by any tool:

1. **Assistive technology handles them badly.** A screen reader may announce Unicode character
   names or skip the run entirely. Heavy styling makes a post genuinely inaccessible.
2. **LinkedIn search cannot index them.** A styled keyword is invisible to search.

So: style headlines and a few key phrases. Leave hashtags, links, and any term you want to be
found by as plain text. The Checks tab flags it when that slips, which is the part most
formatters leave out.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Deployment is handled by `.github/workflows/pages.yml` at the repo root, which builds this
project with `VITE_BASE=/TinyTools/linkedin/` and publishes it alongside the repo's other Pages
surfaces.

## Layout

```
src/
  utils/
    unicode.js     Character maps and the apply/strip transforms
    analyze.js     Every check, plus counting and spacing normalisation
    templates.js   Post structures and opening lines
  components/
    Toolbar.jsx    Style buttons, symbol inserter, spacing fix
    Preview.jsx    LinkedIn post card with truncation and link rendering
    Insights.jsx   Check results and counters
    TemplateLibrary.jsx
  App.jsx          State, selection handling, clipboard
```

The one piece worth reading before changing anything is the exception tables in `unicode.js`.
Unicode had already encoded some of these glyphs in the Basic Multilingual Plane before the
Mathematical Alphanumeric block existed, so those slots inside the block were left unassigned.
Script and outline styles need those holes patched by hand; without the patches you get reserved
code points that render as empty boxes.
