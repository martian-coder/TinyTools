/**
 * Pre-formatted showcase templates.
 *
 * These are written in the house style of well-made company posts — a bold
 * headline, short stacked lines, a divider, concrete numbers, a clear ask. They
 * are original compositions with placeholder brands: reproducing a real
 * company's post would be copying their copy, and putting their logo on this
 * tool would imply an endorsement that does not exist.
 *
 * Bodies are authored in the light markup from unicode.js (`**bold**`,
 * `*italic*`) and compiled through the same engine the editor uses, so what a
 * template inserts is exactly what the editor would have produced by hand.
 *
 * `persona` only drives the preview card. Nothing about it is inserted into the
 * post — LinkedIn supplies the author's name and photo from the account.
 */

export const SHOWCASE_CATEGORIES = [
  { id: 'launch', name: 'Launch' },
  { id: 'milestone', name: 'Milestone' },
  { id: 'hiring', name: 'Hiring' },
  { id: 'research', name: 'Research' },
  { id: 'culture', name: 'Culture' },
  { id: 'partnership', name: 'Partnership' },
];

export const SHOWCASE = [
  {
    id: 'launch-product',
    category: 'launch',
    name: 'Product Launch',
    description: 'Bold headline, three benefits, one number, a clear link. The standard launch shape.',
    persona: { name: 'Northwind', headline: 'Software · 12,400 followers', accent: '#0A66C2' },
    body: `**Today we're shipping [Product].**

Three years ago our customers told us the same thing in every interview: [the problem], and every workaround costs them [what it costs].

So we built the thing they described.

━━━━━━━━━━

**What it does**

✅ [Capability] — cuts [task] from [before] to [after]
✅ [Capability] — no more [specific annoyance]
✅ [Capability] — works with [the tool they already use]

**What we measured in beta**

📊 [Metric]: [number] ([change])
📊 [Metric]: [number] ([change])
📊 Setup time: under [n] minutes

━━━━━━━━━━

It's live today for every [plan/customer type]. [Link]

If you've been solving this with [the common workaround], I'd genuinely like to know whether this clears it.

#[Industry] #ProductLaunch`,
  },
  {
    id: 'launch-feature',
    category: 'launch',
    name: 'Feature Update',
    description: 'Smaller than a launch. Leads with the customer request rather than the release note.',
    persona: { name: 'Meridian', headline: 'Product · 8,200 followers', accent: '#0B7A6E' },
    body: `**You asked. It's shipped.**

[Feature] was the single most requested thing in our feedback board — [n] votes, going back to [date].

It's live now.

**How it works**

1️⃣ [Step, in plain language]
2️⃣ [Step]
3️⃣ [Step]

That's it. No migration, no settings to change.

*One honest note:* [a real limitation of the first version, and when it's being addressed].

Thanks to everyone who kept nudging us about this — especially the [n] of you who wrote in with examples. That's what moved it up the list.

What should we build next? 👇`,
  },
  {
    id: 'milestone-funding',
    category: 'milestone',
    name: 'Funding / Milestone',
    description: 'News without the press-release voice. Leads with what it changes, not the number.',
    persona: { name: 'Arcadia Labs', headline: 'Founder · 5,600 followers', accent: '#6B4EFF' },
    body: `**We raised [amount], led by [investor].**

The number matters less than what it buys, so here's the plan.

**Where it goes**

→ [n] more engineers on [specific problem]
→ [Specific investment — infrastructure, research, support]
→ Keeping [the thing you refuse to compromise] exactly as it is

**Where we are**

📈 [Metric]: [number], up [x] since [date]
👥 [Metric]: [number]
🌍 Customers in [n] countries

━━━━━━━━━━

The part that doesn't fit in a headline: [the honest hard bit — what nearly went wrong, what took longer than expected].

Thank you to [the people] for backing this before it was obvious.

We're hiring across [teams]: [link]`,
  },
  {
    id: 'milestone-anniversary',
    category: 'milestone',
    name: 'Anniversary',
    description: 'A retrospective with real numbers and a real lesson. Reads as reflection, not celebration.',
    persona: { name: 'Halcyon', headline: 'Co-founder · 9,100 followers', accent: '#C2410C' },
    body: `**[n] years ago today, [company] was [what it was — two people, a spreadsheet, an idea].**

Where it stands now:

▪️ [Metric]: [number]
▪️ [Metric]: [number]
▪️ [Team size] people across [n] countries

━━━━━━━━━━

**Three things that turned out to be true**

**1. [Lesson]**
[One sentence of evidence from your own experience.]

**2. [Lesson]**
[One sentence of evidence.]

**3. [Lesson]**
[One sentence of evidence.]

**One thing that turned out to be wrong**

We were certain [the belief]. [What actually happened]. It cost us [what it cost] to find out.

To everyone who took a chance on us early — you know who you are. 🙏`,
  },
  {
    id: 'hiring-role',
    category: 'hiring',
    name: 'Hiring — Key Role',
    description: 'Honest about the hard parts, which is what makes strong candidates self-select in.',
    persona: { name: 'Vantage', headline: 'Talent · 15,300 followers', accent: '#0A66C2' },
    body: `**We're hiring a [Role].**

Before the link, the honest version.

**You'd be good at this if**

✅ [Specific, testable capability]
✅ [Specific, testable capability]
✅ You're comfortable with [the genuine ambiguity of the role]

**You'd hate it if**

❌ [A real downside — small team, no process, legacy code, heavy travel]
❌ [Another real downside]

━━━━━━━━━━

**The first 90 days:** [what they'd actually work on, specifically]

💰 [Salary range] · 📍 [Location / remote] · 🛂 We [do/don't] sponsor visas

Apply here: [link]

Not sure you're a fit? Message me. I'd rather spend five minutes than have you rule yourself out.

#Hiring #[Function]`,
  },
  {
    id: 'hiring-team',
    category: 'hiring',
    name: 'Team Growth',
    description: 'Welcomes new joiners by what they will do, not by listing names alone.',
    persona: { name: 'Lumen', headline: 'People · 6,800 followers', accent: '#0B7A6E' },
    body: `**[n] people joined us this month.**

Rather than a list of names, here's what each of them is actually here to do.

**[Name] — [Role]**
[The specific problem they're taking on.]

**[Name] — [Role]**
[The specific problem they're taking on.]

**[Name] — [Role]**
[The specific problem they're taking on.]

━━━━━━━━━━

We turned down [n] other strong candidates to make these hires, which is the part nobody posts about. If you interviewed with us and it didn't work out this time, it genuinely wasn't a verdict on you.

Still open: [roles]. [Link]`,
  },
  {
    id: 'research-report',
    category: 'research',
    name: 'Research / Report',
    description: 'Leads with the counterintuitive finding and states its limits. Highly shareable.',
    persona: { name: 'Fieldwork', headline: 'Research · 21,000 followers', accent: '#6B4EFF' },
    body: `**We analysed [n] [things]. One finding surprised us.**

[The counterintuitive finding, in one sentence with a number.]

We expected [the intuitive assumption]. The data said the opposite.

━━━━━━━━━━

**What explains it**

📊 [Explanation, with a supporting number]
📊 [Explanation, with a supporting number]
📊 [Explanation, with a supporting number]

**What it changes in practice**

→ [Concrete implication for the reader]
→ [Concrete implication]

━━━━━━━━━━

*Worth stating plainly:* [an honest limitation — sample size, timeframe, selection bias]. This is a signal, not a settled question.

Full method and raw data: [link]

Poke holes in it. That's what it's for. 👇

#Research #[Industry]`,
  },
  {
    id: 'research-teardown',
    category: 'research',
    name: 'Analysis / Teardown',
    description: 'Analyse something public. High reach, low risk, positions you as a thinker.',
    persona: { name: 'A. Rao', headline: 'Strategy · 11,700 followers', accent: '#C2410C' },
    body: `**[Company] just [did the specific public thing].**

Most people are reading it as [the obvious interpretation]. I think it's [your read].

**Three details worth noticing**

**1. [Specific detail]**
[What it implies, and why the obvious reading misses it.]

**2. [Specific detail]**
[What it implies.]

**3. [Specific detail]**
[What it implies.]

━━━━━━━━━━

Put together, this looks less like [obvious interpretation] and more like [your thesis].

*The strongest argument against me:* [the best counterargument, stated fairly].

I could be wrong. What am I missing?`,
  },
  {
    id: 'culture-values',
    category: 'culture',
    name: 'Culture / Ways of Working',
    description: 'A specific practice with its cost stated. Avoids the values-poster trap.',
    persona: { name: 'Beacon', headline: 'Operations · 7,400 followers', accent: '#0A66C2' },
    body: `**We deleted [n]% of our recurring meetings. Nothing broke.**

We audited every one and asked a single question: *what decision does this produce?*

▪️ No decision → became a document
▪️ One decision → became a 15-minute call
▪️ Nobody could answer → cancelled

━━━━━━━━━━

**What happened**

📉 Meeting hours: [before] → [after] per week
📈 [Output metric]: [change]
😐 Complaints: [n], all from people who used meetings to be seen

**What it cost**

Writing takes longer than talking. Our documents got worse before they got better, and for about [timeframe] we were slower, not faster.

We'd do it again. But "just cancel your meetings" skips the part where you have to learn to write.

What's a practice your team changed that actually stuck?`,
  },
  {
    id: 'partnership',
    category: 'partnership',
    name: 'Partnership',
    description: 'Explains what the customer gets rather than congratulating both companies.',
    persona: { name: 'Onyx', headline: 'Partnerships · 10,200 followers', accent: '#0B7A6E' },
    body: `**[Company A] and [Company B] are now integrated.**

Skipping the mutual congratulation — here's what changes for the people who use both.

**Before**

❌ [The manual step that was required]
❌ [The data that had to be re-entered]
❌ [The thing that broke regularly]

**Now**

✅ [What happens automatically]
✅ [What syncs]
✅ [What you stop maintaining]

━━━━━━━━━━

Live today for [who]. Setup takes about [n] minutes: [link]

*Honest scope note:* [what the integration does not yet cover, and when it will].

If you've been holding the two together with [the common workaround], this replaces it.`,
  },
];

/** Every showcase category id, useful for filter UIs. */
export const SHOWCASE_IDS = SHOWCASE.map((t) => t.id);
