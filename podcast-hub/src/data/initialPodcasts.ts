import { PodcastItem } from '../types';

export const INITIAL_PODCASTS: PodcastItem[] = [
  {
    id: 'podcast-1',
    title: 'Lenny’s Podcast: AI Agents, B2B Monetization & Micro-SaaS Ecosystems',
    source: 'https://youtube.com/watch?v=L_LUpnjgPso',
    youtubeVideoId: 'L_LUpnjgPso',
    channel: 'Lenny’s Podcast',
    thumbnailUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80',
    dateAdded: '2026-08-10',
    duration: '1h 12m',
    status: 'Completed',
    masteryLevel: 92,
    shortSummary: `In this episode, Lenny interviews top Silicon Valley product leaders on how autonomous AI agents are radically shifting software pricing models from per-seat to outcome-based pricing. The discussion breaks down actionable ways solopreneurs and small engineering teams can build high-margin micro-SaaS wrappers that integrate vertical workflows.

Key takeaways highlight the transition from selling static tools to selling completed labor. Founders are urged to identify high-friction manual operational tasks—such as automated invoice auditing, candidate screeners, or compliance cross-checking—and build vertical AI workflows with low churn.`,
    detailedSummary: [
      {
        sectionTitle: '1. The Paradigm Shift: Seat-Based Pricing to Outcome-Based Value',
        timestampRange: '02:15 - 18:40',
        content: 'Traditional SaaS charged $20-$50/seat/month. Modern AI agent platforms price based on completed work units (e.g., $5 per resolved support ticket, $15 per qualified sales lead). This aligns pricing directly with ROI, enabling 10x higher ACVs.',
        keyPoints: [
          'Per-seat pricing penalizes efficiency; value-based pricing rewards agent performance.',
          'Buyers approve $10k/mo budget easily if it replaces $50k/mo in outsourced manual operations.',
          'Guardrails and fallback mechanisms are critical to prevent runaway model execution costs.'
        ]
      },
      {
        sectionTitle: '2. Building Micro-SaaS Wrappers with Unfair Distribution',
        timestampRange: '18:41 - 38:10',
        content: 'To defend against giant foundation models, micro-SaaS builders must focus on proprietary integrations, specialized domain context, and tight user feedback loops rather than generic wrapper prompts.',
        keyPoints: [
          'Proprietary domain data connectors create defensible moats.',
          'Workflow stickiness matters more than raw LLM intelligence.',
          'Targeting boring SMB niches (e.g., HVAC scheduling, legal document redlining) offers fast revenue.'
        ]
      },
      {
        sectionTitle: '3. Scaling Engineering Teams with Automated QA & Evaluation Frameworks',
        timestampRange: '38:11 - 1:12:00',
        content: 'Engineering teams building AI agents must implement robust benchmark test suites (evals). Measuring hallucination rate, tool calling accuracy, and response latency is paramount for enterprise compliance.',
        keyPoints: [
          'Evals are the new CI/CD for AI-native software.',
          'Always give human operators an easy fallback button to take control.',
          'Measure cost-per-successful-agent-task to preserve 80%+ gross margins.'
        ]
      }
    ],
    monetizationOpportunities: [
      {
        id: 'mon-101',
        title: 'Vertical AI Compliance Auditor for Niche SMBs',
        description: 'Build an autonomous agent that ingests PDFs and state regulations to auto-generate audit readiness reports for dental clinics or accounting firms.',
        model: 'Outcome-based B2B Subscription ($299/month + $15/audit report)',
        difficulty: 'Medium',
        potentialRevenue: '$15k - $50k / month ARR',
        actionSteps: [
          'Identify top 3 regulatory pain points in regional clinics.',
          'Scrape state guidelines and build vector retrieval context.',
          'Offer free pilot audits to 5 local business owners to secure testimonials.'
        ]
      },
      {
        id: 'mon-102',
        title: 'AI Micro-Agency for E-Commerce Catalog Enrichment',
        description: 'Offer an automated pipeline that takes raw manufacturer product sheets, optimizes SEO descriptions, and generates structured JSON metadata for Shopify stores.',
        model: 'Pay-per-SKU process ($0.50 per enriched product listing)',
        difficulty: 'Easy',
        potentialRevenue: '$5k - $20k / month',
        actionSteps: [
          'Create a standard prompt pipeline with structured outputs.',
          'Connect Shopify GraphQL API to bulk update inventory.',
          'Reach out to mid-market Shopify store owners via Cold Email / LinkedIn.'
        ]
      }
    ],
    ethicsAndDiscipline: [
      {
        id: 'eth-101',
        topic: 'AI Automation vs. Job Displacement Responsibilities',
        summary: 'Discussion on the ethical obligation founders have when selling tools that replace administrative staff.',
        disciplineTakeaway: 'Maintain radical honesty with customers about what AI can and cannot replace accurately.',
        ethicalConsideration: 'Avoiding false claims of 100% accuracy that lead to costly user mistakes.',
        debatePoints: [
          'Is it ethical to sell fully automated agents when humans-in-the-loop are still technically required?',
          'How should pricing reflect liability when an autonomous agent makes a hallucinated decision?'
        ]
      },
      {
        id: 'eth-102',
        topic: 'Daily Deep Work Discipline for Founders',
        summary: 'The speaker shares his strict 3-hour morning block strategy without phone or notifications.',
        disciplineTakeaway: 'Block 9 AM to 12 PM daily solely for core product development before answering external emails.',
        ethicalConsideration: 'Prioritizing customer value creation over superficial vanity metrics and social media posting.',
        debatePoints: [
          'Sustained focus vs reactive customer support in early startup stages.'
        ]
      }
    ],
    reflectionQuestions: [
      {
        id: 'q-101',
        question: 'Why is outcome-based pricing typically more advantageous than seat-based pricing for AI software?',
        type: 'quiz',
        options: [
          'Because users prefer paying for every click',
          'Because AI agents reduce headcounts, so fewer seats are needed, but outcome pricing captures true labor ROI',
          'Because seat-based pricing is illegal for AI tools',
          'Because LLM APIs require pay-per-user tokens'
        ],
        answerHint: 'Outcome-based pricing charges for completed tasks, aligning cost directly with value delivered.'
      },
      {
        id: 'q-102',
        question: 'Which manual, repetitive workflow in your industry could be transformed into an autonomous agent service this month?',
        type: 'reflection',
        answerHint: 'Think about tasks where structured input leads to clear output, like report synthesis or document validation.'
      }
    ],
    keyTimestamps: [
      { timestamp: '02:15', topic: 'Why Seat-Based Pricing is Dying', summary: 'Breakdown of SaaS pricing mechanics' },
      { timestamp: '18:41', topic: 'Micro-SaaS Defensibility', summary: 'Creating moats through domain connectors' },
      { timestamp: '38:11', topic: 'Building Automated Evals', summary: 'Testing LLM reliability and hallucination bounds' },
      { timestamp: '55:20', topic: 'Ethical Automation & Customer Trust', summary: 'Managing expectation gaps' }
    ],
    actionableTakeaways: [
      'Transition product pricing from per-user seat fees to per-task outcome billing.',
      'Establish a strict 3-hour morning deep-work block free from phone notifications.',
      'Build proprietary data connectors to keep micro-SaaS applications defensible against base models.',
      'Implement structured LLM evaluation pipelines (evals) before shipping to enterprise clients.'
    ],
    tags: ['SaaS', 'AI Agents', 'Monetization', 'Product Strategy'],
    userNotes: 'Great podcast! Must re-read the section on building micro-SaaS wrappers. I should try building the Shopify product enrichment pipeline as a weekend experiment.',
    bookmarkedTimestamps: ['02:15', '18:41']
  },
  {
    id: 'podcast-2',
    title: 'Founders Podcast: Andrew Carnegie’s Ruthless Efficiency, Discipline & Industrial Mastery',
    source: 'https://youtube.com/watch?v=3qHkcs3kG44',
    youtubeVideoId: '3qHkcs3kG44',
    channel: 'Founders Podcast',
    thumbnailUrl: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=600&q=80',
    dateAdded: '2026-08-08',
    duration: '58m',
    status: 'In Progress',
    masteryLevel: 65,
    shortSummary: `Host David Senra deconstructs the autobiography and biography of steel magnate Andrew Carnegie. The episode examines how Carnegie leveraged accounting precision, radical cost reduction, and obsessive discipline to construct the largest industrial empire of the 19th century.

Key lessons focus on Carnegie's relentless focus on unit economics ("Watch the costs, and the profits will take care of themselves") and his ethical framework regarding wealth accumulation and philanthropy later in life.`,
    detailedSummary: [
      {
        sectionTitle: '1. Obsession with Unit Costs & Accounting Mechanics',
        timestampRange: '00:00 - 15:30',
        content: 'While competitors focused on maximizing revenue or price cartels, Carnegie focused exclusively on lowering cost per ton of steel. When steel prices crashed, Carnegie remained profitable while rivals went bankrupt.',
        keyPoints: [
          'Knowing your exact unit costs down to the penny provides total leverage.',
          'Reinvest all capital into superior technology during market downturns.',
          'Cost accounting is the ultimate competitive moat.'
        ]
      },
      {
        sectionTitle: '2. Executive Discipline & Partnership Culture',
        timestampRange: '15:31 - 36:15',
        content: 'Carnegie surrounded himself with brilliant partners like Henry Clay Frick, granting them junior equity shares tied strictly to performance metrics.',
        keyPoints: [
          'Tie partner incentives directly to measurable cost reduction goals.',
          'Relentless energy and single-minded focus outperform diffuse talent.',
          'Maintain written daily ledgers of priorities.'
        ]
      },
      {
        sectionTitle: '3. The Gospel of Wealth: Ethics & Legacy',
        timestampRange: '36:16 - 58:00',
        content: 'The episode explores Carnegie’s philosophical shift: accumulating wealth ruthlessly in youth, then distributing 90%+ to public libraries, universities, and peace foundations before death.',
        keyPoints: [
          'Wealth accumulated without purpose leads to spiritual decay.',
          'Philanthropy should build enduring public infrastructure (e.g. 2,500+ public libraries).',
          'Ethical dilemmas of industrial labor disputes vs public philanthropy.'
        ]
      }
    ],
    monetizationOpportunities: [
      {
        id: 'mon-201',
        title: 'Cloud Cost Optimization & FinOps Agency',
        description: 'A modern equivalent of Carnegie’s cost ledger: audit tech startups’ AWS/GCP bills to reduce cloud infrastructure spending by 30% with a gain-share model.',
        model: 'Performance Fee (Keep 30% of savings generated in Year 1)',
        difficulty: 'Medium',
        potentialRevenue: '$10k - $40k / client engagement',
        actionSteps: [
          'Develop automated cloud scanning scripts for idle EC2/Kubernetes instances.',
          'Pitch CFOs on a zero-risk contingency basis: if we save $100k, we take $30k.',
          'Build standardized monthly FinOps executive dashboards.'
        ]
      }
    ],
    ethicsAndDiscipline: [
      {
        id: 'eth-201',
        topic: 'Unit Economics Accounting as Personal Discipline',
        summary: 'Carnegie required every mill superintendent to present daily cost ledgers.',
        disciplineTakeaway: 'Track daily personal time expenditure and business metrics with zero self-delusion.',
        ethicalConsideration: 'Ensuring cost-cutting never compromises employee physical safety or product standards.',
        debatePoints: [
          'Was Carnegie’s labor management ethically defensible given the Homestead Strike?',
          'Does late-life philanthropy erase aggressive early business practices?'
        ]
      }
    ],
    reflectionQuestions: [
      {
        id: 'q-201',
        question: 'What is your core business or personal spending metric that corresponds to Carnegie’s "cost per ton"?',
        type: 'reflection',
        answerHint: 'Identify the single input cost metric that determines your profit margin or personal burn rate.'
      }
    ],
    keyTimestamps: [
      { timestamp: '05:10', topic: 'Watch the Costs, Profits Follow', summary: 'Carnegie’s golden business rule' },
      { timestamp: '22:40', topic: 'Incentivizing Key Partners', summary: 'Structuring equity and bonus metrics' },
      { timestamp: '41:15', topic: 'The Gospel of Wealth', summary: 'Ethical duty of capital allocators' }
    ],
    actionableTakeaways: [
      'Perform a line-item cost audit on your software stack and eliminate unused subscriptions.',
      'Tie team rewards strictly to measurable operational efficiency metrics.',
      'Write down a clear mission statement for how your business profits will create positive societal impact.'
    ],
    tags: ['Mindset', 'History', 'Business Strategy', 'Ethics'],
    userNotes: 'Remember: Carnegie bought competitors during panic crashes because his unit costs were lower than everyone else. Focus on unit economics!',
    bookmarkedTimestamps: ['05:10']
  },
  {
    id: 'podcast-3',
    title: 'Huberman Lab: Cognitive Discipline, High-Performance Routines & Dopamine Management',
    source: 'https://youtube.com/watch?v=gX_m3fU3e18',
    youtubeVideoId: 'gX_m3fU3e18',
    channel: 'Huberman Lab',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80',
    dateAdded: '2026-08-05',
    duration: '1h 45m',
    status: 'Completed',
    masteryLevel: 100,
    shortSummary: `Dr. Andrew Huberman explains neurobiological protocols to optimize mental focus, prevent burnout, and manage dopamine baselines. The episode provides scientific frameworks for structuring work blocks, managing physical energy, and maintaining psychological resilience during prolonged stress.

Key tools include morning light viewing, NSDR (Non-Sleep Deep Rest) for rapid cognitive recovery, and dopamine reset strategies to sustain intrinsic motivation.`,
    detailedSummary: [
      {
        sectionTitle: '1. Dopamine Dynamics & Intrinsic Motivation',
        timestampRange: '00:00 - 32:00',
        content: 'Dopamine is not just a reward signal; it is the currency of effort and anticipation. Layering external rewards (money, praise) on top of effort can diminish intrinsic enjoyment. Learn to attach dopamine to the friction of work itself.',
        keyPoints: [
          'Reward the effort, not just the outcome.',
          'Avoid combining caffeine, music, and high stimulants on easy work days to prevent baseline crash.',
          'Cold exposure or brief physical stress raises baseline dopamine for hours.'
        ]
      },
      {
        sectionTitle: '2. Ultradian Rhythms & Deep Work Cycles',
        timestampRange: '32:01 - 1:10:00',
        content: 'The brain operates in 90-minute ultradian cycles. The first 10-15 minutes involve mental friction before entering flow state. Design maximum 2 ultradian blocks per day for deep focus.',
        keyPoints: [
          'Expect mental friction during min 1-15 of deep work; do not switch tabs.',
          'Use NSDR (10-20 min guided relaxation) at 2 PM to restore alertness.',
          'View sunlight within 30 minutes of waking to anchor circadian cortisol rhythm.'
        ]
      }
    ],
    monetizationOpportunities: [
      {
        id: 'mon-301',
        title: 'Guided NSDR & Ultradian Focus Timer App',
        description: 'Develop a specialized web/mobile timer tailored to 90-minute ultradian focus sessions integrated with biometric heart-rate variability feedback and automated NSDR audio resets.',
        model: 'Freemium Subscription ($7.99/mo premium features)',
        difficulty: 'Easy',
        potentialRevenue: '$10k - $30k / month',
        actionSteps: [
          'Design minimal UI with 90m countdown and pre-session intention prompt.',
          'Embed high-quality audio sessions recorded with licensed audio guides.',
          'Market on productivity Twitter/Reddit communities.'
        ]
      }
    ],
    ethicsAndDiscipline: [
      {
        id: 'eth-301',
        topic: 'Ethical Science Communication & Evidence Levels',
        summary: 'Huberman stresses distinguishing human peer-reviewed trials from rodent pilot studies.',
        disciplineTakeaway: 'Be rigorous with facts in your own product marketing and content creation.',
        ethicalConsideration: 'Never over-promise health or cognitive gains without disclaimers.',
        debatePoints: [
          'Responsibility of influencers when recommending bio-hacking protocols.'
        ]
      }
    ],
    reflectionQuestions: [
      {
        id: 'q-301',
        question: 'How many uninterrupted 90-minute ultradian deep work blocks do you complete in a typical workday?',
        type: 'reflection',
        answerHint: 'Most high performers manage 1 to 2 quality blocks max per day.'
      }
    ],
    keyTimestamps: [
      { timestamp: '12:30', topic: 'Dopamine Baseline Management', summary: 'Sustaining intrinsic motivation' },
      { timestamp: '45:10', topic: 'The 90-Minute Focus Protocol', summary: 'Structuring deep work cycles' },
      { timestamp: '1:15:00', topic: 'NSDR Recovery Protocol', summary: 'Restoring neurotransmitters mid-day' }
    ],
    actionableTakeaways: [
      'Schedule 90-minute focus blocks without phone distractions.',
      'Get 10 minutes of direct morning sunlight to anchor sleep and alertness.',
      'Practice 10-minute Non-Sleep Deep Rest (NSDR) during afternoon energy dips.'
    ],
    tags: ['Mindset', 'Productivity', 'Health', 'Discipline'],
    userNotes: 'NSDR works wonders for mid-day focus! I should incorporate 90-minute timer blocks into this app dashboard.',
    bookmarkedTimestamps: ['12:30', '45:10']
  }
];
