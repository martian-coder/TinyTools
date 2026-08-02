# LinkedIn Formatter

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

**A drag-and-drop builder.** Switch to Build mode and assemble a post from blocks — hook,
paragraph, bullet list, numbered list, metric, quote, divider, closing ask, hashtags. Each block
compiles to plain text and the post is joined together in whatever order you arrange them, so you
can move the ask above the evidence and see what it does without retyping anything. Reordering
works three ways: pointer drag, the arrow buttons, and those same buttons under keyboard focus.
The arrows are not just an accessibility fallback — HTML5 drag events don't fire on touch screens
at all, so on a phone they are the only way to reorder. Send the result to the editor when you're
ready to style it.

**31 templates in a gallery below the preview**, each rendered as a LinkedIn-shaped card so you
judge it as a post rather than as source text. Ten are pre-formatted showcase posts — launches,
milestones, hiring, research, culture, partnerships — carrying bold headings, bullets and
dividers already. The other 21 are plain structures whose value is the shape rather than the
styling. All of them use bracketed placeholders to mark where a real number, name or link has to
go, because that specificity is the whole reason any of them work.

Every template carries hashtags, and they are left **plain on purpose** — LinkedIn matches
hashtags on their literal characters, so a styled one is not clickable and appears in no feed.

Each showcase card also shows the kind of visual that post type usually carries: a product shot
for a launch, a chart for a research drop, a logo lockup for a partnership. These are drawn as SVG
from the template's accent colour and exist to tell you what to prepare — the image itself has to
be uploaded to LinkedIn separately, since post text cannot contain one.

The showcase posts are original compositions with placeholder brands, and the logo lockup is a
generic placeholder. Copying a real company's post would be copying their copy, and putting their
logo on this tool would imply an endorsement that does not exist.

**An image button that is honest about what it does.** LinkedIn post text cannot contain an
image — an image is a separate media upload. The button adds one to the *preview* so you can see
how the post will look, and nothing else: it never enters the text, never leaves your browser and
is never uploaded. You still attach the file on LinkedIn yourself.

**250+ emoji**, grouped by the job they do in a post rather than by Unicode category, with
keyword search and a recents row. Note that GIFs cannot be embedded in post text by any tool —
they work in comments, in messages, or attached as media, but the post body is plain text. Emoji
are the only inline visual that renders.

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
    templates.js   Plain post structures, opening lines, closing asks
    showcase.js    Pre-formatted showcase posts, authored in light markup
    emoji.js       Categorised emoji with search keywords
    symbols.js     181 symbols in ten searchable groups
    limits.js      LinkedIn's published field limits
    lists.js       Bullet and numbered list toggling
    blocks.js      Block types and the block-to-text compiler
  components/
    Ribbon.jsx     Formatting ribbon: undo/redo, styles, lists, image, counter
    Preview.jsx    LinkedIn post card with truncation, links and preview image
    Insights.jsx   Check results and counters
    BlockComposer.jsx  Drag-and-drop builder
    TemplateGallery.jsx  Rendered template cards
    EmojiPicker.jsx / SymbolPicker.jsx
  App.jsx          State, selection handling, clipboard, Write/Build modes
```

Two things are worth knowing before changing the composer. Blocks are the source of truth in
Build mode and the freeform text is ignored, so everything downstream reads a single `activeText`
value. And the drop handler reads the dragged block's id back out of the `dataTransfer` rather
than from React state — state set during `dragstart` has not necessarily flushed by the time
`drop` fires, and the `dataTransfer` is the one thing the browser guarantees survives the gesture.

The one piece worth reading before changing anything is the exception tables in `unicode.js`.
Unicode had already encoded some of these glyphs in the Basic Multilingual Plane before the
Mathematical Alphanumeric block existed, so those slots inside the block were left unassigned.
Script and outline styles need those holes patched by hand; without the patches you get reserved
code points that render as empty boxes.

## A note on search visibility

The on-page SEO is done properly: a keyword-leading `<title>`, a meta description inside the
truncation limit, a single H1 carrying the target phrase, `SoftwareApplication` and `FAQPage`
structured data, Open Graph and Twitter cards, and a canonical URL. The FAQ answers the questions
people actually search before they find a tool like this, and the markup matches that visible
content — rich results are only granted when it does.

What that will not do on its own is outrank Typefully or Taplio. Ranking for a competitive term is
mostly domain authority and backlinks, and a `github.io` subpath has close to none of either. It
also cannot be moved to a custom domain without changing the canonical URL and the Open Graph URLs
in `index.html`, which is a two-line edit when the domain is ready.

The realistic path is: ship here, point a real domain at it, then earn links — a Show HN, the
relevant subreddits, and answers on the existing questions about LinkedIn formatting that already
rank. The accessibility and broken-hashtag checks are the genuinely novel part and the most
linkable angle, because no competing tool warns about either.
