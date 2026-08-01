/**
 * Starting structures, not fill-in-the-blank scripts. Each one is a shape that
 * reliably holds attention; the words still have to be the author's own.
 */
export const TEMPLATES = [
  {
    id: 'hook-story-lesson',
    name: 'Story → Lesson',
    description: 'A specific moment, what it cost, what it taught. The most reliable structure on the platform.',
    body: `I got the email at 4pm on a Friday.

We'd lost the account.

Eight months of work, gone in three paragraphs.

Here's what I got wrong:

• I optimised for the person who liked me, not the person who signed
• I confused activity with progress
• I never asked what would make them leave

The account I won the following quarter came from asking exactly that question in the first meeting.

What's the most expensive lesson your work has taught you?`,
  },
  {
    id: 'contrarian',
    name: 'Contrarian Take',
    description: 'Name the consensus, disagree precisely, back it with something you actually saw.',
    body: `Everyone says you should niche down.

I didn't. It worked.

Not because the advice is wrong — because it's aimed at a stage I wasn't at yet.

Niching down assumes you already know what you're good at. I didn't. I needed two years of taking mismatched work to find out.

The advice isn't "niche down."

It's "niche down once you have enough evidence to know which niche."

Sequence matters more than the tactic.

Where have you seen good advice given at the wrong time?`,
  },
  {
    id: 'listicle',
    name: 'Numbered Lessons',
    description: 'Scannable and highly shareable. Works when each point stands alone.',
    body: `5 things I wish I'd known before my first management job:

1️⃣ Your job is no longer to be the best at the work
It's to make the work happen without you.

2️⃣ Silence in a 1:1 is information
Sit in it. They're deciding whether to tell you something.

3️⃣ Praise in public, specifics in private
"Great job" means nothing. "The way you handled the client's objection" means everything.

4️⃣ You will be wrong in front of people
Do it well and you buy more trust than being right ever earns.

5️⃣ Protect your calendar or someone else will fill it

Which one took you longest to learn?`,
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'A concrete transformation with the mechanism in between. Good for case studies.',
    body: `Before: 40 hours a week in meetings.
After: 12.

Same output. Here's the change.

I audited every recurring meeting and asked one question: what decision does this produce?

If the answer was "none," it became a document.
If the answer was "one," it became a 15-minute call.
If nobody could answer, it got cancelled.

Nothing broke.

Three months on, the only complaint has been from people who liked meetings as a place to be seen.

That turned out to be useful information too.`,
  },
  {
    id: 'question-first',
    name: 'Question Opener',
    description: 'Opens a loop in the first line. Strong hook when the question is genuinely uncomfortable.',
    body: `When was the last time you changed your mind about something important at work?

Not adjusted. Changed.

I asked a room of 30 senior people this last week. Four hands went up.

That's not a failure of character. It's a structural problem — most of us are rewarded for consistency and punished for reversal, so we learn to defend positions rather than update them.

The teams I've seen move fastest do one thing differently: they make changing your mind a status move rather than a cost.

"I was wrong about this, here's what changed" gets applause, not a raised eyebrow.

How does your team handle it?`,
  },
  {
    id: 'announcement',
    name: 'Announcement',
    description: 'News without the press-release voice. Lead with what it means for the reader.',
    body: `We shipped something today that I've wanted to build for three years.

The short version: [what it does, in one sentence a stranger would understand].

The longer version:

Most tools in this space solve [problem] by [common approach]. That works until [specific breaking point], which is exactly where our customers kept getting stuck.

So we tried something different — [the mechanism].

It's live now. Free while we learn from how people use it.

If you've hit that wall before, I'd genuinely like to hear whether this clears it: [link]`,
  },
];

/** Reusable openers, worth keeping separate from full templates. */
export const HOOKS = [
  'I got the email at 4pm on a Friday.',
  "Everyone says X. I did the opposite. Here's what happened.",
  'This took me 6 years and about £40,000 to learn.',
  "The best advice I ever got came from someone I didn't respect at the time.",
  'I turned down the offer. Here is the reasoning.',
  "Nobody talks about the part that actually goes wrong.",
  'Three years ago I was doing the opposite of this.',
  'A candidate asked me a question last week that I could not answer.',
];
