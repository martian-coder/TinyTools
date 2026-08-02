/**
 * Post structures, grouped by the situation you're writing in.
 *
 * These are shapes, not scripts. The specifics in each body are placeholders with
 * the *shape* of a real detail — a number, a date, a quoted sentence — because the
 * structure only works when it carries something concrete. Swapping in vague
 * language ("great results", "amazing team") collapses every one of them.
 */

export const TEMPLATE_CATEGORIES = [
  { id: 'story', name: 'Story' },
  { id: 'insight', name: 'Insight' },
  { id: 'career', name: 'Career' },
  { id: 'hiring', name: 'Hiring' },
  { id: 'founder', name: 'Founder' },
  { id: 'data', name: 'Data' },
  { id: 'milestone', name: 'Milestone' },
];

export const TEMPLATES = [
  // ─── Story ──────────────────────────────────────────────────────────────
  {
    id: 'story-lesson',
    category: 'story',
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

What's the most expensive lesson your work has taught you?

#Leadership #Lessons #Sales`,
  },
  {
    id: 'story-failure',
    category: 'story',
    name: 'The Failure Post',
    description: 'Own a real mistake without performing humility. Requires an actual cost, stated plainly.',
    body: `I shipped a bug that cost us £30,000 in refunds.

Not a metaphor. Thirty thousand pounds, in one weekend, because I skipped a test I'd decided was "obviously fine".

The part nobody warns you about isn't the money.

It's the 20 minutes between noticing and telling someone. Every instinct says wait, check again, make sure. Every one of those minutes made it worse.

I told my manager at 9:40am. By 11 we'd rolled back and drafted the customer email.

She said one thing I've repeated ever since:

"The bug was a mistake. Waiting would have been a decision."

I've never sat on bad news again.

#Leadership #Engineering #Ownership`,
  },
  {
    id: 'story-mentor',
    category: 'story',
    name: 'Someone Who Changed Things',
    description: 'Credit a specific person for a specific shift. Warm without being saccharine.',
    body: `My first manager gave me feedback I hated for about two years.

"You're solving the problem you were given. Nobody asked you to check whether it's the right problem."

I thought it was unfair. I was hitting every deadline.

What she meant took me until my third job to understand: being reliable makes you valuable to your manager. Being right about what matters makes you valuable to the company. They are not the same skill, and only one of them compounds.

I still send her a message every time it pays off.

Who gave you the feedback you needed rather than the feedback you wanted?

#Mentorship #Leadership #CareerAdvice`,
  },

  // ─── Insight ────────────────────────────────────────────────────────────
  {
    id: 'insight-contrarian',
    category: 'insight',
    name: 'Contrarian Take',
    description: 'Name the consensus, disagree precisely, back it with something you actually saw.',
    body: `Everyone says you should niche down.

I didn't. It worked.

Not because the advice is wrong — because it's aimed at a stage I wasn't at yet.

Niching down assumes you already know what you're good at. I didn't. I needed two years of taking mismatched work to find out.

The advice isn't "niche down."

It's "niche down once you have enough evidence to know which niche."

Sequence matters more than the tactic.

Where have you seen good advice given at the wrong time?

#Strategy #CareerAdvice #Leadership`,
  },
  {
    id: 'insight-listicle',
    category: 'insight',
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

Which one took you longest to learn?

#Management #Leadership #FirstTimeManager`,
  },
  {
    id: 'insight-question',
    category: 'insight',
    name: 'Question Opener',
    description: 'Opens a loop in the first line. Strong hook when the question is genuinely uncomfortable.',
    body: `When was the last time you changed your mind about something important at work?

Not adjusted. Changed.

I asked a room of 30 senior people this last week. Four hands went up.

That's not a failure of character. It's a structural problem — most of us are rewarded for consistency and punished for reversal, so we learn to defend positions rather than update them.

The teams I've seen move fastest do one thing differently: they make changing your mind a status move rather than a cost.

"I was wrong about this, here's what changed" gets applause, not a raised eyebrow.

How does your team handle it?

#Leadership #DecisionMaking #Teams`,
  },
  {
    id: 'insight-myth',
    category: 'insight',
    name: 'Myth vs Reality',
    description: 'Two-column thinking in plain text. Good for correcting a widely repeated claim.',
    body: `"Remote work kills culture."

I've now run both. Here's what actually changed:

What people think happens:
❌ Nobody talks to each other
❌ Junior people stop learning
❌ Culture disappears

What actually happens:
✅ Casual conversation drops to near zero — this part is true
✅ Junior people stop learning by osmosis and need it made explicit
✅ Culture doesn't disappear. It stops being accidental.

The failure mode isn't remote. It's running a remote team on habits built for a room.

Every good remote team I know replaced something they lost, on purpose. The ones that struggled just took the office away and hoped.

What did your team have to make deliberate?

#RemoteWork #Culture #Leadership`,
  },

  // ─── Career ─────────────────────────────────────────────────────────────
  {
    id: 'career-move',
    category: 'career',
    name: 'New Role',
    description: 'Announce a move without the corporate voice. Lead with the why, not the title.',
    body: `I've joined [company] as [role].

The short reason: I kept running into the same problem at my last three jobs, and they're the only team I've found actually working on it.

The longer reason:

[One or two sentences on the specific thing that convinced you — a conversation, a product decision, something you saw them do.]

I'm spending the first month mostly listening. If you work in [area] and have opinions about [specific problem], I'd genuinely like to hear them.

And to the team at [previous company] — thank you. [One specific thing you're taking with you.]

#NewRole #Career #[Industry]`,
  },
  {
    id: 'career-leaving',
    category: 'career',
    name: 'Leaving a Role',
    description: 'A goodbye post that says something. Specific gratitude beats a list of adjectives.',
    body: `Friday was my last day at [company], after [n] years.

I could list what we shipped. Instead, three things I'm taking with me:

[Name] taught me that the quality of a decision and the quality of its outcome are different things, and you have to review them separately.

[Name] taught me to write the document before the meeting. Half the meetings then turned out to be unnecessary.

[Name] taught me that "I don't know, let me find out" is a complete and respectable answer at any level.

That's the actual product of a good job. The rest is on a CV somewhere.

Next: [what's next, or "taking a few weeks off before saying more"].

#Career #Gratitude #NewChapter`,
  },
  {
    id: 'career-jobsearch',
    category: 'career',
    name: 'Open to Work',
    description: 'Specific and useful rather than a plea. Makes it easy for someone to help.',
    body: `I'm looking for my next role.

Rather than list adjectives about myself, here's what I'm actually good at and what I'm looking for.

What I do well:
• [Specific skill, with a number or outcome attached]
• [Specific skill, with a number or outcome attached]
• [The thing colleagues actually come to you for]

What I'm looking for:
• [Type of role and seniority]
• [Industry or problem space, and why]
• [Location, remote, hybrid]

What would help most: an introduction to anyone hiring in [area], or a 15-minute conversation if you've made a similar move.

Happy to return the favour whenever it's useful. 🙏

#OpenToWork #Hiring #[Function]`,
  },

  // ─── Hiring ─────────────────────────────────────────────────────────────
  {
    id: 'hiring-role',
    category: 'hiring',
    name: "We're Hiring",
    description: 'A job post people actually read. Honest about the hard parts.',
    body: `We're hiring a [role].

Before the link, the honest version.

You'd be good at this if:
✅ [Specific, testable thing]
✅ [Specific, testable thing]
✅ You're comfortable with [genuine ambiguity of the role]

You'd hate it if:
❌ [Real downside — small team, no process, heavy travel, legacy code]
❌ [Another real downside]

The first 90 days: [what they'd actually work on].

Salary: [range]. Location: [where]. We [do/don't] sponsor visas.

If that sounds right, apply here: [link]

If you're not sure, message me — I'd rather have a five-minute conversation than have you self-select out.

#Hiring #[Function] #[Industry]`,
  },
  {
    id: 'hiring-lesson',
    category: 'hiring',
    name: 'What Hiring Taught Me',
    description: 'Reframes a process everyone complains about. Strong comment driver.',
    body: `I've now interviewed about 400 people.

The single best predictor of whether someone would do well wasn't on any scorecard.

It was whether they asked a question that showed they'd thought about our problem, not their fit.

"What does success look like in this role?" — fine, but rehearsed.
"What breaks most often, and who gets paged?" — that person had already started working.

The second group outperformed the first, consistently, at every level.

It isn't about being clever. It's a proxy for something harder to test: whether you're curious about the actual work or about getting the job.

Interviewers — what's the question that changed your mind about a candidate?

#Hiring #Recruiting #Interviewing`,
  },

  // ─── Founder ────────────────────────────────────────────────────────────
  {
    id: 'founder-launch',
    category: 'founder',
    name: 'Product Launch',
    description: 'News without the press-release voice. Lead with what it means for the reader.',
    body: `We shipped something today that I've wanted to build for three years.

The short version: [what it does, in one sentence a stranger would understand].

The longer version:

Most tools in this space solve [problem] by [common approach]. That works until [specific breaking point], which is exactly where our customers kept getting stuck.

So we tried something different — [the mechanism].

It's live now. Free while we learn from how people use it.

If you've hit that wall before, I'd genuinely like to hear whether this clears it: [link]

#ProductLaunch #Startups #BuildInPublic`,
  },
  {
    id: 'founder-behind',
    category: 'founder',
    name: 'Building in Public',
    description: 'Progress update with a real number and a real problem. Builds an audience over time.',
    body: `Month [n] of building [product].

The numbers:
📈 [Metric]: [number] ([change] from last month)
👥 [Metric]: [number]
💰 [Metric]: [number]

What worked:
[One thing, specifically. Not "marketing" — the actual action.]

What didn't:
[One thing that genuinely failed, and what it cost.]

What I'm stuck on:
[A real open question. This is the part that gets useful replies.]

Doing this in public because the version of this post I needed to read two years ago didn't exist. Happy to answer anything in the comments.

#BuildInPublic #Startups #Founders`,
  },
  {
    id: 'founder-decision',
    category: 'founder',
    name: 'A Hard Decision',
    description: 'Walk through real reasoning. Earns trust faster than a win post.',
    body: `We turned down [an opportunity most people would take].

Here's the reasoning, because I think the framework is more useful than the decision.

The offer: [what it was, and why it was genuinely tempting].

Three questions we asked:

1. Does this make the core product better, or just bigger?
2. What do we stop doing to say yes?
3. If this works, what does year three look like — and do we want to run that company?

Question 3 killed it.

It would have worked. That was the problem. We'd have spent three years building something we didn't want to own.

Saying no to a good opportunity is much harder than saying no to a bad one. Nobody warns you about that.

#Founders #Strategy #Startups`,
  },

  // ─── Data ───────────────────────────────────────────────────────────────
  {
    id: 'data-finding',
    category: 'data',
    name: 'Surprising Finding',
    description: 'Lead with the counterintuitive number. Works only if the data is real.',
    body: `We analysed [n] [things] and found something we didn't expect.

[The surprising finding, in one sentence with a number.]

We assumed [the intuitive expectation]. The data said the opposite.

Digging in, three things explained it:

📊 [Explanation, with a supporting number]
📊 [Explanation, with a supporting number]
📊 [Explanation, with a supporting number]

What it changes in practice: [the actionable takeaway].

Caveat worth stating: [an honest limitation of the data — sample, timeframe, selection bias].

Full method in the comments for anyone who wants to pick holes in it. 👇

#Data #Research #[Industry]`,
  },
  {
    id: 'data-beforeafter',
    category: 'data',
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

That turned out to be useful information too.

#Productivity #WaysOfWorking #Leadership`,
  },
  {
    id: 'data-teardown',
    category: 'data',
    name: 'Breakdown / Teardown',
    description: 'Analyse something publicly visible. High shareability, low risk.',
    body: `[Company] just [did a specific public thing].

Most people are reading it as [the obvious interpretation]. I think it's [your read].

Three details worth noticing:

1. [Specific detail, and what it implies]

2. [Specific detail, and what it implies]

3. [Specific detail, and what it implies]

Put together, this looks less like [obvious interpretation] and more like [your thesis].

I could be wrong — [the strongest argument against your read].

What am I missing?

#Strategy #Analysis #[Industry]`,
  },

  // ─── Milestone ──────────────────────────────────────────────────────────
  {
    id: 'milestone-anniversary',
    category: 'milestone',
    name: 'Work Anniversary',
    description: 'Avoids the "n years at X!" trap by making it about what changed.',
    body: `[n] years at [company] today.

The version of me who started would not recognise how I work now.

Then → Now:

Measured a good week by how much I shipped
→ Measure it by how much moved without me

Wanted to be the person with the answer
→ Want to be the person who asked the question that got there

Thought disagreement was a risk to manage
→ Think silence is

Thought seniority meant certainty
→ Fairly sure it means being comfortable saying "I don't know" in front of more people

Thanks to everyone who dragged me from the left column to the right one. 🙏

#WorkAnniversary #Gratitude #Career`,
  },
  {
    id: 'milestone-gratitude',
    category: 'milestone',
    name: 'Thank You',
    description: 'Specific gratitude. Names people and says what they actually did.',
    body: `[The thing] happened this week. I want to be specific about who made it happen, because "thanks to the team" is how people become invisible.

[Name] — [the specific thing they did, and why it mattered].

[Name] — [the specific thing they did, and why it mattered].

[Name] — [the specific thing they did, and why it mattered].

And to [person outside the team], who [what they did] without being asked and without needing the credit: noticed. 👏

The post that just says "proud of the team" is easier to write. This one is more true.

#Gratitude #Teamwork #Leadership`,
  },
  {
    id: 'milestone-award',
    category: 'milestone',
    name: 'Recognition',
    description: 'Accept an award without either false modesty or a victory lap.',
    body: `We were named [award] this week.

I want to be honest about what that does and doesn't mean.

What it doesn't mean: that we've worked it out. [A genuine current weakness.]

What it does mean: that [the specific thing being recognised] is working, and that thing was a deliberate bet we made [when] when it wasn't obvious.

The bet: [what you chose to do differently].

It cost us [what it cost — time, revenue, speed] for about [how long] before it paid off. There was a stretch where I wasn't sure it would.

To anyone in the middle of a bet that hasn't paid off yet: that's what the middle feels like. 🙏

Thanks to [the people], and to [the customers/community] for the patience.

#Award #Gratitude #Startups`,
  },
];

/** Reusable openers, worth keeping separate from full templates. */
export const HOOKS = [
  'I got the email at 4pm on a Friday.',
  "Everyone says X. I did the opposite. Here's what happened.",
  'This took me 6 years and about £40,000 to learn.',
  "The best advice I ever got came from someone I didn't respect at the time.",
  'I turned down the offer. Here is the reasoning.',
  'Nobody talks about the part that actually goes wrong.',
  'Three years ago I was doing the opposite of this.',
  'A candidate asked me a question last week that I could not answer.',
  'We were wrong about this for two years.',
  'The most useful thing I did last year took 20 minutes.',
  "I've interviewed 400 people. One question predicts more than the rest combined.",
  'This is the post I needed to read when I started.',
];

/** Closing lines that ask for something specific enough to answer. */
export const CLOSERS = [
  "What's the most expensive lesson your work has taught you?",
  'Where have you seen good advice given at the wrong time?',
  'What would you add?',
  "What am I missing?",
  'How does your team handle this?',
  "If you've solved this, I'd genuinely like to hear how.",
  'Curious whether this matches your experience.',
  'Happy to answer anything in the comments. 👇',
];
