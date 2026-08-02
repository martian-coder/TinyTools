import React from 'react';

/**
 * Real answers to the questions people actually search before they find a tool
 * like this. Mirrors the FAQPage structured data in index.html — rich results are
 * only granted when the markup matches visible content, and the answers are worth
 * reading regardless of what any crawler makes of them.
 */
const FAQS = [
  {
    q: 'Can you use bold text in a LinkedIn post?',
    a: `Not natively. LinkedIn feed posts accept plain text only — there is no bold button, and no Markdown or HTML support. Rich text exists in Articles and Newsletters, but not in the feed composer where most people post.

Bold text works by substituting each letter for a character from Unicode's Mathematical Alphanumeric Symbols block. "H" becomes "𝗛" — a different character that happens to look bold. LinkedIn passes it through untouched, because as far as it is concerned that is just ordinary text.`,
  },
  {
    q: 'Why does my formatting disappear when I paste into LinkedIn?',
    a: `Because LinkedIn throws the formatting away. When you copy out of Word or Google Docs, the styling travels alongside the text as rich-text markup. LinkedIn strips all of it and keeps the letters, which is why a carefully formatted draft arrives as a flat wall.

Styling built into the characters themselves survives, because there is nothing left to strip. That is the whole mechanism behind this tool, and the reason the copy button writes plain text only.`,
  },
  {
    q: 'Do styled hashtags work on LinkedIn?',
    a: `No, and this is the mistake that quietly costs the most. LinkedIn matches hashtags on their literal characters, so a hashtag written in styled Unicode is not clickable, will not appear in any hashtag feed, and returns nothing in search. It looks completely normal in your post, which is why it goes unnoticed.

The same applies to links: a styled URL is inert text that nobody can click or copy. Leave both as plain characters — the Checks tab flags it when you forget.`,
  },
  {
    q: 'How many characters can a LinkedIn post be?',
    a: `Three thousand. The catch is that styled characters cost two each against that limit, so a post that looks comfortably short can still be rejected.

Separately, only about the first 140 characters are visible on mobile before the post collapses behind a "see more" link. That cut usually lands mid-sentence, so the opening line is worth writing to fit.`,
  },
  {
    q: 'Is Unicode formatting bad for accessibility?',
    a: `Yes, and no tool can fix it. Those characters are not letters, so screen readers may announce their Unicode names or skip past them entirely. Somebody using assistive technology can end up hearing noise instead of your post.

That is an argument for restraint rather than avoidance. Style a headline and a few key phrases; leave the body, the hashtags, the links and any term you want to be found by as plain text. This tool warns you when styling creeps past roughly a third of the post, which is about where it stops being emphasis and starts being a barrier.`,
  },
  {
    q: 'Is it free?',
    a: `Yes, with no account and no sign-up. Everything you write runs in your browser: your drafts, your profile details and any image you attach to the preview are stored on your own device and never sent anywhere.

The one exception is the email list, and only if you choose to join it — then your email address is sent to the mailing service and nothing else goes with it. Your posts are never part of that.`,
  },
];

export default function About() {
  return (
    <section className="max-w-7xl mx-auto px-4 pb-12 pt-2 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">
          How LinkedIn formatting actually works
        </h2>
        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-3">
          <p>
            <strong className="text-slate-900 dark:text-slate-200">Why pasting normally breaks.</strong>{' '}
            LinkedIn feed posts accept plain text only — no HTML, no Markdown. Copying styled text
            out of a document sends formatting LinkedIn discards, which is why it arrives flat. This
            tool builds the styling into the characters themselves, so nothing gets stripped on the
            way in.
          </p>
          <p>
            <strong className="text-slate-900 dark:text-slate-200">The trade-off worth knowing.</strong>{' '}
            Those characters are not real letters. Screen readers handle them badly and LinkedIn
            search cannot index them. Style headlines and key phrases; leave hashtags, links and
            terms you want to be found by as plain text. The Checks tab flags it when that slips.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
        <h2 className="text-lg font-semibold mb-1 text-slate-900 dark:text-slate-100">
          Common questions
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-3">
              <summary className="cursor-pointer list-none flex items-start gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                <span className="text-slate-400 group-open:rotate-90 transition-transform mt-0.5">
                  ›
                </span>
                <h3 className="font-medium">{f.q}</h3>
              </summary>
              <div className="pl-5 pt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
