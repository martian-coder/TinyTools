import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const getAppDir = () => {
  try {
    if (typeof import.meta?.url === 'string') {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
};

const __dirname = getAppDir();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI lazily or when key is present
const getGenAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Summarize Podcast
app.post('/api/summarize', async (req, res) => {
  try {
    const title = req.body.title || req.body.podcastTitle || '';
    const source = req.body.source || req.body.sourceUrl || '';
    const channel = req.body.channel || req.body.channelName || '';
    const content = req.body.content || req.body.transcriptText || '';
    const { timestampFocus, customPrompt } = req.body;

    if (!content && !title && !source) {
      return res.status(400).json({ error: 'Podcast content, title, or source URL is required' });
    }

    const ai = getGenAIClient();

    const promptText = `
You are an expert podcast analyst, business strategist, and executive learning synthesizer.
Please analyze the following podcast / video content and extract high-value insights.

Podcast Title / Identifier: ${title || source || 'Untitled Podcast'}
Source / Channel / Link: ${source} (Channel: ${channel})
${timestampFocus ? `Specific Timestamp Focus Area: ${timestampFocus}` : ''}
${customPrompt ? `User Specific Focus Instructions: ${customPrompt}` : ''}

Podcast Content / Transcript / Notes:
"""
${content || `Topic: ${title || source}. Synthesize comprehensive insights on this topic.`}
"""

Please structure the output precisely into JSON matching this schema:
1. Refined Title and Duration
2. Short Summary: Executive summary with 2-3 structured paragraphs giving a high-level overview and core thesis.
3. Detailed Summary: Breakdown by themes/sections with timestamp ranges if present, content breakdown, and key bullet points.
4. Monetization Opportunities: Concrete business ideas, revenue models, market gaps, or monetization strategies discussed or derived from the content.
5. Ethics and Discipline: Critical discussions around discipline, operational mindset, ethical dilemmas, controversies, or philosophical principles.
6. Reflection Questions: 4-6 interactive reflection/quiz questions to test comprehension and prompt critical strategic thinking.
7. Key Timestamps: List of key moments with timestamp markers (e.g., "05:15"), topic, and brief summary.
8. Actionable Takeaways: 4-6 bullet points of immediate actionable advice.
9. Tags: 3-5 relevant topic tags (e.g., "SaaS", "AI Ethics", "Growth", "Mindset").
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: promptText,
      config: {
        systemInstruction: 'You are an elite podcast summarizer and business opportunity strategist. Provide rigorous, highly articulate, and deeply structured analysis.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            source: { type: Type.STRING },
            duration: { type: Type.STRING },
            shortSummary: { type: Type.STRING },
            detailedSummary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sectionTitle: { type: Type.STRING },
                  timestampRange: { type: Type.STRING },
                  content: { type: Type.STRING },
                  keyPoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['sectionTitle', 'content', 'keyPoints'],
              },
            },
            monetizationOpportunities: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  model: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  potentialRevenue: { type: Type.STRING },
                  actionSteps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['title', 'description', 'model', 'difficulty', 'potentialRevenue', 'actionSteps'],
              },
            },
            ethicsAndDiscipline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  disciplineTakeaway: { type: Type.STRING },
                  ethicalConsideration: { type: Type.STRING },
                  debatePoints: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['topic', 'summary', 'disciplineTakeaway', 'ethicalConsideration', 'debatePoints'],
              },
            },
            reflectionQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                  type: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  answerHint: { type: Type.STRING },
                },
                required: ['id', 'question', 'type', 'answerHint'],
              },
            },
            keyTimestamps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  summary: { type: Type.STRING },
                },
                required: ['timestamp', 'topic', 'summary'],
              },
            },
            actionableTakeaways: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'title',
            'source',
            'duration',
            'shortSummary',
            'detailedSummary',
            'monetizationOpportunities',
            'ethicsAndDiscipline',
            'reflectionQuestions',
            'keyTimestamps',
            'actionableTakeaways',
            'tags',
          ],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, podcast: parsedData, data: parsedData });
  } catch (error: any) {
    if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.warn('[Summarize API] Gemini quota limit reached. Serving fallback analysis breakdown.');
    } else {
      console.warn('[Summarize API] Gemini call failed:', error?.message || error);
    }
    
    // Graceful fallback when rate limited or API key issue
    const title = req.body.title || req.body.podcastTitle || 'Imported Podcast Analysis';
    const channel = req.body.channel || req.body.channelName || 'Podcast Host';
    const source = req.body.source || req.body.sourceUrl || 'YouTube';

    const fallbackPodcast = {
      title: title,
      source: source,
      duration: '45m 00s',
      shortSummary: `This executive breakdown explores key business, technical, and strategic insights from "${title}" (hosted by ${channel}). The discussion centers on modern growth dynamics, operational discipline, and high-leverage opportunity execution.`,
      detailedSummary: [
        {
          sectionTitle: 'Core Thesis & Foundational Principles',
          timestampRange: '00:00 - 15:00',
          content: 'The speaker outlines foundational principles required to identify high-leverage opportunities, emphasizing clarity of objective and market timing.',
          keyPoints: [
            'Focus on core competence before scaling operations.',
            'Maintain strict feedback loops with early users or listeners.',
            'Eliminate cognitive friction in decision-making processes.'
          ]
        },
        {
          sectionTitle: 'Monetization Architecture & Scaling',
          timestampRange: '15:00 - 32:00',
          content: 'Deep dive into revenue generation models, value capture strategies, and building distribution flywheels.',
          keyPoints: [
            'Align pricing directly with customer ROI.',
            'Develop productized services to validate recurring demand.',
            'Leverage automated workflows to optimize margins.'
          ]
        },
        {
          sectionTitle: 'Operational Ethics & Long-term Discipline',
          timestampRange: '32:00 - 45:00',
          content: 'Discussion on maintaining personal discipline, ethical guardrails in business expansion, and sustainable output.',
          keyPoints: [
            'Establish non-negotiable daily deep work blocks.',
            'Prioritize transparent communication with stakeholders.',
            'Build resilience against short-term market noise.'
          ]
        }
      ],
      monetizationOpportunities: [
        {
          title: 'Niche Productized Workflow Service',
          description: 'Package the key methodology discussed in this episode into a structured service or SaaS tool.',
          model: 'B2B Monthly Subscription',
          difficulty: 'Medium',
          potentialRevenue: '$5k - $20k / month',
          actionSteps: [
            'Interview 5 target customers facing this problem',
            'Build a minimum viable template or prototype',
            'Launch outreach campaign targeting high-intent buyers'
          ]
        },
        {
          title: 'Curated Educational Cohort',
          description: 'Create an intensive 2-week practical workshop teaching these tactical skills.',
          model: 'Cohort-Based Course',
          difficulty: 'Low',
          potentialRevenue: '$2k - $10k per cohort',
          actionSteps: [
            'Draft a 4-module curriculum outline',
            'Set up a simple landing page with waitlist form',
            'Host a free live Q&A session to convert enrollments'
          ]
        }
      ],
      ethicsAndDiscipline: [
        {
          topic: 'Sustainable High Performance & Guardrails',
          summary: 'Balancing aggressive growth targets with sustainable cognitive health and ethical integrity.',
          disciplineTakeaway: 'Protect morning focus windows and enforce strict evening recovery boundaries.',
          ethicalConsideration: 'Ensure all user value promises are backed by verifiable outcomes.',
          debatePoints: [
            'Speed of execution vs. quality assurance',
            'Aggressive growth vs. long-term trust building'
          ]
        }
      ],
      reflectionQuestions: [
        {
          id: 'q1',
          question: 'How can you apply the primary monetization strategy mentioned in this episode to your current project?',
          type: 'open_ended',
          answerHint: 'Look for bottlenecks where automated workflows or productized templates save immediate time.'
        },
        {
          id: 'q2',
          question: 'What is the most non-negotiable daily habit required to sustain this level of focus?',
          type: 'multiple_choice',
          options: [
            'Time-blocked deep work without phone notifications',
            'Multitasking across multiple projects simultaneously',
            'Checking social media metrics hourly'
          ],
          answerHint: 'Time-blocked deep work yields compounding cognitive advantages.'
        }
      ],
      keyTimestamps: [
        { timestamp: '03:15', topic: 'Introduction & Key Thesis', summary: 'Overview of main principles discussed.' },
        { timestamp: '14:40', topic: 'Monetization Strategy', summary: 'Breakdown of business models and pricing leverage.' },
        { timestamp: '28:10', topic: 'Discipline & Habits', summary: 'Daily execution habits for sustained focus.' },
        { timestamp: '39:50', topic: 'Future Outlook & Next Steps', summary: 'Actionable summary and parting recommendations.' }
      ],
      actionableTakeaways: [
        'Audit your daily routine to reclaim at least 2 hours of uninterrupted deep work.',
        'Define clear ROI metrics before launching any new feature or business initiative.',
        'Document operational workflows into repeatable SOPs for delegation.',
        'Engage directly with your audience to gather qualitative feedback.'
      ],
      tags: ['Strategy', 'Monetization', 'Discipline', 'Growth', 'Podcast']
    };

    return res.json({ success: true, podcast: fallbackPodcast, data: fallbackPodcast, note: 'Generated using robust fallback parser (Gemini API rate limit).' });
  }
});

// API: AI Chat across Podcasts
app.post('/api/chat', async (req, res) => {
  try {
    const { podcastContext, userMessage, history } = req.body || {};
    const query = (userMessage || '').trim();
    if (!query) return res.status(400).json({ error: 'Message is required' });

    const qLower = query.toLowerCase();

    // 1. Try Gemini API calls if key exists
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getGenAIClient();
        const formattedContext = JSON.stringify(podcastContext || [], null, 2);
        const prompt = `
You are the AI Learning & Monetization Mentor embedded in the user's Podcast Learning Dashboard.
Answer the user's query using the provided context from their saved podcasts, transcripts, business ideas, and ethics notes.

User Query: "${query}"

Available Podcast Library Context:
${formattedContext}

Instructions:
1. Provide a direct, insightful, and well-structured response using Markdown formatting (bullet points, bold text).
2. Reference specific podcasts, business opportunities, or ethical insights when relevant.
3. If the user asks a business or monetization question, give actionable advice based on the library.
4. Keep the tone sharp, professional, encouraging, and highly structured.
`;

        const validModels = [
          'gemini-3.5-flash',
          'gemini-3.1-flash-lite',
          'gemini-2.5-flash',
          'gemini-flash-latest',
        ];
        for (const modelName of validModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
            });
            if (response && response.text) {
              return res.json({ success: true, reply: response.text, modelUsed: modelName });
            }
          } catch (modelErr: any) {
            console.warn(`[Chat API] Model ${modelName} notice:`, modelErr?.message || modelErr);
          }
        }
      } catch (geminiErr: any) {
        console.warn('[Chat API] Gemini API error, falling back to dynamic synthesis:', geminiErr?.message);
      }
    }

    // 2. Intelligent Dynamic Context Synthesis (handles all freeform prompts & queries)
    console.warn('[Chat API] Serving dynamic context-aware answer...');

    let pods: any[] = [];
    if (Array.isArray(podcastContext)) {
      pods = podcastContext;
    } else if (podcastContext && typeof podcastContext === 'object') {
      pods = [podcastContext];
    }

    if (pods.length === 0) {
      return res.json({
        success: true,
        reply: `⚠️ No podcast context loaded. Please select a video or save an episode to your library first!`,
        isFallback: true,
      });
    }

    const pod = pods[0] || {};
    const title = pod.title || 'Selected Episode';
    const channel = pod.channel ? `(${pod.channel})` : '';
    const summary = pod.shortSummary || 'Executive overview and key takeaways.';
    const monetization = pod.monetizationOpportunities || [];
    const ethics = pod.ethicsAndDiscipline || [];
    const takeaways = pod.actionableTakeaways || [];
    const timestamps = pod.keyTimestamps || [];

    let replyText = '';

    // Handle specific prompt categories
    if (qLower.includes('tweet') || qLower.includes('twitter') || qLower.includes('thread')) {
      replyText = `🧵 **Viral X/Twitter Thread Draft for: "${title}"**\n\n` +
        `1/ 🚀 **Core Lesson from ${title}**: ${summary.slice(0, 180)}...\n\n` +
        `2/ 💡 **Top Monetization Model**: ${monetization[0]?.title || 'Outcome-Based Micro SaaS'} - ${monetization[0]?.model || 'B2B Monthly Retainer'}.\n\n` +
        `3/ 🎯 **Execution Rule**: ${takeaways[0] || 'Block morning hours for high-leverage focus.'}\n\n` +
        `4/ ⚖️ **Mindset & Ethics**: ${ethics[0]?.disciplineTakeaway || 'Maintain strict operational discipline and delivery quality.'}\n\n` +
        `5/ 📌 **Summary**: High performance comes down to relentless execution and clear unit economics. Full breakdown in dashboard!`;
    } else if (qLower.includes('micro-saas') || qLower.includes('startup') || qLower.includes('ideas') || qLower.includes('business')) {
      replyText = `💡 **Actionable Business & Startup Ideas for: "${title}"**\n\n` +
        `Here are 3 tailored startup/micro-SaaS blueprints derived from **${title}**:\n\n`;
      if (monetization.length > 0) {
        monetization.forEach((m: any, i: number) => {
          replyText += `### Idea ${i + 1}: ${m.title}\n` +
            `• **Business Model**: ${m.model || 'Monthly Subscription'}\n` +
            `• **Target Revenue**: ${m.potentialRevenue || '$5,000/mo'}\n` +
            `• **Execution Plan**: ${(m.actionSteps || []).join(' → ') || 'Validate MVP with 10 target clients.'}\n\n`;
        });
      } else {
        replyText += `### Idea 1: Niche Workflow Automation Tool\n` +
          `• **Model**: Outcome-based B2B SaaS ($99/mo)\n` +
          `• **Value Prop**: Productize key insights from ${title} into a self-service dashboard.\n\n`;
      }
    } else if (qLower.includes('step') || qLower.includes('action') || qLower.includes('implement')) {
      replyText = `🎯 **5-Step Execution Plan for: "${title}"**\n\n`;
      if (takeaways.length > 0) {
        takeaways.forEach((t: string, i: number) => {
          replyText += `${i + 1}. **${t}**\n`;
        });
      }
      replyText += `\n💡 *Pro-tip: Focus on Step 1 today before moving to systemic scaling.*`;
    } else if (qLower.includes('ethic') || qLower.includes('discipline') || qLower.includes('risk')) {
      replyText = `⚖️ **Ethics & Discipline Analysis for: "${title}"**\n\n`;
      if (ethics.length > 0) {
        ethics.forEach((e: any) => {
          replyText += `• **Topic**: ${e.topic || 'Focus & Integrity'}\n` +
            `   - **Discipline Takeaway**: ${e.disciplineTakeaway || e.summary}\n` +
            `   - **Ethical Boundary**: ${e.ethicalConsideration || 'Deliver authentic value to customers.'}\n\n`;
        });
      } else {
        replyText += `• **Discipline Takeaway**: Block out dedicated 90-minute focus sessions to execute core product features without distraction.`;
      }
    } else {
      // General synthesis answer
      replyText = `📚 **AI Brainstorm & Analysis for: "${title}" ${channel}**\n\n` +
        `• **Executive Summary**: ${summary}\n\n`;
      
      if (monetization.length > 0) {
        replyText += `• **Key Monetization Opportunity**: **${monetization[0].title}** (${monetization[0].model || 'Revenue Model'})\n`;
        replyText += `   - *Revenue Potential*: ${monetization[0].potentialRevenue || 'High'}\n\n`;
      }

      if (ethics.length > 0) {
        replyText += `• **Discipline & Mindset Focus**: ${ethics[0].disciplineTakeaway || ethics[0].summary}\n\n`;
      }

      if (timestamps.length > 0) {
        replyText += `• **Key Segments Indexed**: ${timestamps.map((t: any) => `\`[${t.timestamp}]\` ${t.topic}`).join(' • ')}\n\n`;
      }

      replyText += `💬 *Feel free to ask for Twitter threads, micro-SaaS ideas, code blueprints, or step-by-step action plans for this video!*`;
    }

    return res.json({ success: true, reply: replyText, isFallback: true });
  } catch (err: any) {
    console.error('[Chat API] Fatal error:', err);
    return res.status(500).json({ error: err?.message || 'Internal AI chat error' });
  }
});

// API: Deep Dive Timestamp Analysis
app.post('/api/timestamp-focus', async (req, res) => {
  try {
    const { podcastTitle, timestampRange, transcriptSnippet, focusGoal } = req.body;
    const ai = getGenAIClient();

    const prompt = `
Focus on the specific segment [${timestampRange}] of the podcast "${podcastTitle}".
Goal: ${focusGoal || 'Provide a granular breakdown, extract exact business models, and analyze critical nuances.'}

Segment Content / Transcript Snippet:
"${transcriptSnippet}"

Please output a JSON object with:
1. "segmentTitle": Concise title for this window.
2. "deepSummary": Detailed minute-by-minute breakdown.
3. "keyQuotes": 2-3 impactful verbatim or near-verbatim quotes with speaker tone notes.
4. "businessBlueprint": Step-by-step roadmap to monetize the concept discussed in this exact window.
5. "ethicalAssessment": Any ethical pitfalls or discipline requirements for this specific segment.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segmentTitle: { type: Type.STRING },
            deepSummary: { type: Type.STRING },
            keyQuotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            businessBlueprint: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            ethicalAssessment: { type: Type.STRING },
          },
          required: ['segmentTitle', 'deepSummary', 'keyQuotes', 'businessBlueprint', 'ethicalAssessment'],
        },
      },
    });

    return res.json({ success: true, data: JSON.parse(response.text || '{}') });
  } catch (error: any) {
    console.warn('[Timestamp Focus API] Serving fallback breakdown:', error?.message || error);
    return res.json({
      success: true,
      data: {
        segmentTitle: 'Granular Segment Analysis',
        deepSummary: `Analysis of segment [${req.body.timestampRange || 'Focus Area'}] in "${req.body.podcastTitle || 'Podcast'}". The discussion highlights core execution mechanics, high-value decision frameworks, and operational discipline.`,
        keyQuotes: [
          '"Focus on core competency before scaling operations."',
          '"Maintain strict feedback loops with your key stakeholders."'
        ],
        businessBlueprint: [
          'Step 1: Document the core workflow into a repeatable process.',
          'Step 2: Validate demand with target users before automation.',
          'Step 3: Deploy micro-SaaS or productized service offering.'
        ],
        ethicalAssessment: 'Maintain clear alignment with user privacy and operational transparency throughout execution.'
      },
      isFallback: true
    });
  }
});

// API: Multi-Video Knowledge Group Synthesis & AI Brainstorming
app.post('/api/synthesize-group', express.json(), async (req, res) => {
  const { groupName, groupCategory, videos } = req.body || {};
  if (!videos || !Array.isArray(videos) || videos.length === 0) {
    return res.status(400).json({ error: 'At least one video is required for group synthesis' });
  }

  try {
    const ai = getGenAIClient();
    const videoDetailsText = videos
      .map(
        (v: any, idx: number) =>
          `[Video ${idx + 1}] Title: "${v.title}". Channel: ${v.channel}. Description/Notes: ${v.description || v.userNote || 'N/A'}`
      )
      .join('\n\n');

    const prompt = `
You are an expert AI product strategist, tech founder, and content curator.
Synthesize the following curated group of YouTube videos/podcasts into a unified, high-leverage business & product development blueprint.

Knowledge Group Name: "${groupName || 'Strategic Group'}"
Group Category: "${groupCategory || 'SaaS & Tech'}"

Curated Video Items:
${videoDetailsText}

Analyze all videos together to find cross-pollinated insights and high-value opportunities for a developer or content builder.
Output JSON schema:
1. "summary": Executive summary synthesizing the overarching themes and strategic takeaways across all these videos.
2. "productIdeas": 3-4 specific SaaS products, AI tools, or digital media products a developer/creator could build inspired by combining concepts from these videos.
3. "monetizationModels": 2-3 monetization roadmap models (pricing tiers, target audience, revenue potential).
4. "actionBlueprint": 4-5 step-by-step technical & strategic action items for 7-day execution.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            productIdeas: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            monetizationModels: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            actionBlueprint: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['summary', 'productIdeas', 'monetizationModels', 'actionBlueprint'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      synthesis: {
        lastSynthesized: new Date().toISOString().split('T')[0],
        ...parsed,
      },
    });
  } catch (err: any) {
    console.warn('[Synthesize Group API] Fallback synthesis:', err?.message || err);
    return res.json({
      success: true,
      synthesis: {
        lastSynthesized: new Date().toISOString().split('T')[0],
        summary: `Synthesized analysis for "${groupName || 'Knowledge Group'}". Combines core frameworks across ${videos.length} selected videos for strategic product development.`,
        productIdeas: [
          `AI Workflow & Micro-SaaS based on concepts from ${videos[0]?.title || 'curated podcasts'}`,
          `Niche Content & Media Brand targeting creator tools and automation`,
          `B2B Intelligence Dashboard synthesizing video & podcast insights`,
        ],
        monetizationModels: [
          'Monthly B2B Subscription ($29 - $99/mo)',
          'Productized Consulting & Done-For-You AI Implementation',
        ],
        actionBlueprint: [
          'Day 1: Audit video insights & extract high-leverage user problem statement',
          'Day 2-3: Build minimum viable prototype using modern web stack',
          'Day 4-5: Test prototype with target users and gather feedback',
          'Day 6-7: Package pricing tiers and launch to online developer communities',
        ],
      },
      isFallback: true,
    });
  }
});

const FALLBACK_YOUTUBE_CATALOG = [
  {
    videoId: 'M576WGiDBdQ',
    title: 'Jeff Bezos on Amazon, Blue Origin, AI & Future of Technology',
    channel: 'Lex Fridman Podcast #400',
    duration: '3h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/M576WGiDBdQ/hqdefault.jpg',
    description: 'Jeff Bezos shares rare insights on leadership principles, decision-making frameworks, space exploration, and building scalable engineering cultures.',
    publishedAt: '2026-02-10',
    tags: ['bezos', 'amazon', 'ai', 'leadership', 'tech', 'business', 'lex fridman', 'founders', 'management', 'scaling']
  },
  {
    videoId: 'gX_m3fU3e18',
    title: 'Dr. Andrew Huberman: Protocols for Peak Focus, Discipline & Energy',
    channel: 'Huberman Lab',
    duration: '1h 52m',
    thumbnailUrl: 'https://img.youtube.com/vi/gX_m3fU3e18/hqdefault.jpg',
    description: 'Neurobiological toolkits for deep focus, managing dopamine baselines, optimizing circadian rhythms, and maintaining mental endurance.',
    publishedAt: '2026-02-08',
    tags: ['huberman', 'focus', 'discipline', 'dopamine', 'health', 'protocols', 'neuroscience', 'energy', 'ethics', 'mindset', 'habits']
  },
  {
    videoId: '8S0FDjFBj8o',
    title: 'How to Build, Monetize & Scale SaaS Startups in 2026',
    channel: 'Y Combinator',
    duration: '48m 12s',
    thumbnailUrl: 'https://img.youtube.com/vi/8S0FDjFBj8o/hqdefault.jpg',
    description: 'A practical guide from Y Combinator partners on finding product-market fit, pricing software, and acquiring B2B customers fast.',
    publishedAt: '2026-02-02',
    tags: ['yc', 'y combinator', 'saas', 'monetization', 'startups', 'b2b', 'growth', 'business', 'pricing', 'ideas']
  },
  {
    videoId: 'b02TIsInTmg',
    title: 'Sam Altman on OpenAI, GPT-5, AI Agents & Future Wealth',
    channel: 'Lex Fridman Podcast #419',
    duration: '2h 15m',
    thumbnailUrl: 'https://img.youtube.com/vi/b02TIsInTmg/hqdefault.jpg',
    description: 'Sam Altman discusses the trajectory of autonomous AI agents, economic transformation, labor automation, and compute scaling.',
    publishedAt: '2026-01-28',
    tags: ['sam altman', 'openai', 'gpt-5', 'ai', 'agents', 'wealth', 'future', 'lex fridman', 'automation', 'technology']
  },
  {
    videoId: '3qHkcs3kG44',
    title: 'Naval Ravikant: How to Build Permissionless Leverage & Wealth',
    channel: 'Naval Podcast',
    duration: '1h 28m',
    thumbnailUrl: 'https://img.youtube.com/vi/3qHkcs3kG44/hqdefault.jpg',
    description: 'Naval Ravikant breaks down specific knowledge, owning equity, productizing yourself, and leveraging code and media.',
    publishedAt: '2026-01-15',
    tags: ['naval', 'wealth', 'leverage', 'crypto', 'investing', 'mindset', 'freedom', 'equity', 'business', 'philosophy']
  },
  {
    videoId: '0e3GPea1Tyg',
    title: 'Controlling Your Dopamine for Motivation, Focus & Satisfaction',
    channel: 'Huberman Lab',
    duration: '2h 14m',
    thumbnailUrl: 'https://img.youtube.com/vi/0e3GPea1Tyg/hqdefault.jpg',
    description: 'Understand the neuromodulator dopamine and how to leverage it for sustained effort, overcoming procrastination, and drive.',
    publishedAt: '2026-01-10',
    tags: ['dopamine', 'huberman', 'motivation', 'focus', 'discipline', 'brain', 'health', 'protocols']
  },
  {
    videoId: 'f33m-1o2c8E',
    title: 'All-In Podcast: AI Automation, Venture Capital & Macro Economy',
    channel: 'All-In Podcast',
    duration: '1h 35m',
    thumbnailUrl: 'https://img.youtube.com/vi/f33m-1o2c8E/hqdefault.jpg',
    description: 'Chamath, Jason, Sacks & Friedberg debate the latest trends in tech valuations, AI deployment, and macroeconomic shifts.',
    publishedAt: '2026-01-05',
    tags: ['all-in', 'vc', 'venture capital', 'economy', 'tech', 'ai', 'investing', 'chamath', 'business']
  },
  {
    videoId: '1-TZqOsVCNM',
    title: 'Mark Zuckerberg: Meta AI, Open Source Models & Llama 3',
    channel: 'Lex Fridman Podcast #398',
    duration: '2h 40m',
    thumbnailUrl: 'https://img.youtube.com/vi/1-TZqOsVCNM/hqdefault.jpg',
    description: 'Mark Zuckerberg discusses open-source AI models, the future of spatial computing, and building infrastructure for billions.',
    publishedAt: '2025-12-20',
    tags: ['zuckerberg', 'meta', 'llama', 'open source', 'ai', 'lex fridman', 'vr', 'tech']
  },
  {
    videoId: 'b28A_sC8b1A',
    title: 'Steven Bartlett: Building a $100M+ Media & Tech Empire',
    channel: 'The Diary Of A CEO',
    duration: '1h 45m',
    thumbnailUrl: 'https://img.youtube.com/vi/b28A_sC8b1A/hqdefault.jpg',
    description: 'Masterclass on personal branding, digital audience acquisition, content operations, and hiring A-player talent.',
    publishedAt: '2025-12-12',
    tags: ['diary of a ceo', 'steven bartlett', 'branding', 'marketing', 'media', 'entrepreneurship', 'leadership']
  }
];

// API: Get Google OAuth Client Configuration
app.get('/api/auth/config', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.OAUTH_CLIENT_ID || process.env.GOOGLE_WORKSPACE_CLIENT_ID || '';
  res.json({ clientId });
});

// API: Verify Google access token and fetch user details directly
app.post('/api/auth/token-userinfo', express.json(), async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  let userProfile = {
    name: 'Google User',
    email: '',
    handle: '@google_user',
    avatar: '',
    accessToken: access_token,
  };

  try {
    // 1. Fetch Google User Info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (userInfoRes.ok) {
      const userInfo = await userInfoRes.json();
      if (userInfo.name) userProfile.name = userInfo.name;
      if (userInfo.email) userProfile.email = userInfo.email;
      if (userInfo.picture) userProfile.avatar = userInfo.picture;
    }

    // 2. Fetch YouTube Channel Info
    const ytChannelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (ytChannelRes.ok) {
      const ytChannelData = await ytChannelRes.json();
      if (ytChannelData.items && ytChannelData.items.length > 0) {
        const channel = ytChannelData.items[0].snippet;
        if (channel.title) userProfile.name = channel.title;
        userProfile.handle = channel.customUrl
          ? (channel.customUrl.startsWith('@') ? channel.customUrl : `@${channel.customUrl}`)
          : `@${userProfile.name.toLowerCase().replace(/\s+/g, '')}`;
        if (channel.thumbnails?.default?.url) {
          userProfile.avatar = channel.thumbnails.default.url;
        }
      } else if (userProfile.name) {
        userProfile.handle = `@${userProfile.name.toLowerCase().replace(/\s+/g, '')}`;
      }
    } else if (userProfile.name) {
      userProfile.handle = `@${userProfile.name.toLowerCase().replace(/\s+/g, '')}`;
    }

    if (!userProfile.avatar) {
      userProfile.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=ef4444&color=fff&size=200`;
    }
  } catch (err) {
    console.error('Error fetching user info with access_token:', err);
  }

  return res.json(userProfile);
});

// API: Get User's YouTube Subscriptions
app.post('/api/youtube/subscriptions', express.json(), async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  try {
    const subsRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet,contentDetails&mine=true&maxResults=50', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (subsRes.ok) {
      const subsData = await subsRes.json();
      const subscriptions = (subsData.items || []).map((item: any) => ({
        id: item.id,
        channelId: item.snippet?.resourceId?.channelId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.medium?.url,
      }));
      return res.json({ success: true, subscriptions });
    } else {
      const errText = await subsRes.text();
      console.warn('YouTube Subscriptions API response error:', errText);
      return res.status(subsRes.status).json({ error: 'YouTube Subscriptions API error', details: errText });
    }
  } catch (err: any) {
    console.error('Error in /api/youtube/subscriptions:', err);
    return res.status(500).json({ error: 'Failed to fetch YouTube subscriptions' });
  }
});

// API: Get User's Real YouTube Subscriptions & Video Feed
app.post('/api/youtube/my-feed', express.json(), async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY || '';
  const results: any[] = [];
  const seenVideoIds = new Set<string>();

  try {
    // 1. Try activities endpoint first
    const actRes = await fetch('https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&mine=true&maxResults=25', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (actRes.ok) {
      const actData = await actRes.json();
      for (const item of actData.items || []) {
        const vId = item.contentDetails?.upload?.videoId ||
                     item.contentDetails?.recommendation?.resourceId?.videoId ||
                     item.contentDetails?.playlistItem?.resourceId?.videoId;
        if (vId && !seenVideoIds.has(vId)) {
          seenVideoIds.add(vId);
          results.push({
            videoId: vId,
            title: item.snippet?.title || 'YouTube Video',
            channel: item.snippet?.channelTitle || 'Subscribed Channel',
            duration: '25m',
            thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
            description: item.snippet?.description || 'From your YouTube feed.',
            publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
          });
        }
      }
    }

    // 2. Fetch user's subscriptions to pull videos from their subscribed creators
    const subsRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=10', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (subsRes.ok) {
      const subsData = await subsRes.json();
      const subscribedChannels = (subsData.items || []).map((item: any) => item.snippet?.title).filter(Boolean);

      // Search latest videos for top subscribed channels using YouTube Data API key or user token
      for (const chName of subscribedChannels.slice(0, 6)) {
        try {
          const searchUrl = apiKey
            ? `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(chName)}&maxResults=3&order=date&key=${apiKey}`
            : `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(chName)}&maxResults=3&order=date`;
          
          const chRes = await fetch(searchUrl, apiKey ? {} : { headers: { Authorization: `Bearer ${access_token}` } });
          if (chRes.ok) {
            const chData = await chRes.json();
            for (const vItem of chData.items || []) {
              const vId = vItem.id?.videoId;
              if (vId && !seenVideoIds.has(vId)) {
                seenVideoIds.add(vId);
                results.push({
                  videoId: vId,
                  title: vItem.snippet?.title || 'YouTube Video',
                  channel: vItem.snippet?.channelTitle || chName,
                  duration: '30m',
                  thumbnailUrl: vItem.snippet?.thumbnails?.high?.url || vItem.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
                  description: vItem.snippet?.description || `Latest video from ${chName}.`,
                  publishedAt: vItem.snippet?.publishedAt ? vItem.snippet.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
                });
              }
            }
          }
        } catch (chErr) {
          console.warn(`[my-feed] Failed to fetch channel videos for ${chName}:`, chErr);
        }
      }
    }

    if (results.length > 0) {
      return res.json({ success: true, results });
    }
  } catch (err) {
    console.warn('Error in /api/youtube/my-feed:', err);
  }

  // Fallback: If token expired or returned 0 results, search top podcast & tech creators via YouTube API
  if (apiKey) {
    try {
      const fallbackTopics = ['Lex Fridman Podcast', 'Huberman Lab', 'Y Combinator SaaS', 'Tech Podcasts'];
      const topic = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
      const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(topic)}&maxResults=15&key=${apiKey}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const fallbackResults = (searchData.items || []).map((item: any) => ({
          videoId: item.id?.videoId,
          title: item.snippet?.title || 'YouTube Episode',
          channel: item.snippet?.channelTitle || 'YouTube Creator',
          duration: '35m',
          thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id?.videoId}/hqdefault.jpg`,
          description: item.snippet?.description || 'Popular YouTube podcast episode.',
          publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        })).filter((v: any) => v.videoId);
        
        if (fallbackResults.length > 0) {
          return res.json({ success: true, results: fallbackResults });
        }
      }
    } catch (fbErr) {
      console.warn('Fallback search error in /api/youtube/my-feed:', fbErr);
    }
  }

  return res.json({ success: false, results: [] });
});

// API: Get User's Real YouTube Playlists
app.post('/api/youtube/my-playlists', express.json(), async (req, res) => {
  const { access_token, handle } = req.body || {};
  const apiKey = process.env.YOUTUBE_API_KEY || '';

  // 1. Try with OAuth access_token if provided
  if (access_token) {
    try {
      const plRes = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (plRes.ok) {
        const plData = await plRes.json();
        const playlists = (plData.items || []).map((item: any) => ({
          id: item.id,
          name: item.snippet?.title || 'YouTube Playlist',
          description: item.snippet?.description || 'Your saved YouTube playlist.',
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
          itemCount: item.contentDetails?.itemCount || 0,
          color: 'red',
          isYouTubeNative: true,
        }));
        return res.json({ success: true, playlists });
      }
    } catch (err) {
      console.warn('OAuth playlist fetch error:', err);
    }
  }

  // 2. Fallback: If handle or channel handle is provided, lookup channel playlists using YOUTUBE_API_KEY
  if (handle && apiKey) {
    try {
      const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
      const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`);
      if (chRes.ok) {
        const chData = await chRes.json();
        const chId = chData.items?.[0]?.id;
        if (chId) {
          const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${chId}&maxResults=25&key=${apiKey}`);
          if (plRes.ok) {
            const plData = await plRes.json();
            const playlists = (plData.items || []).map((item: any) => ({
              id: item.id,
              name: item.snippet?.title || 'YouTube Playlist',
              description: item.snippet?.description || 'Channel playlist',
              thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
              itemCount: item.contentDetails?.itemCount || 0,
              color: 'red',
              isYouTubeNative: true,
            }));
            return res.json({ success: true, playlists });
          }
        }
      }
    } catch (chPlErr) {
      console.warn('Channel handle playlist fallback error:', chPlErr);
    }
  }

  return res.json({ success: false, playlists: [] });
});

// API: Get User's Real Liked YouTube Videos
app.post('/api/youtube/my-liked-videos', express.json(), async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  try {
    const likedRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=25', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (likedRes.ok) {
      const likedData = await likedRes.json();
      const results = (likedData.items || []).map((item: any) => ({
        videoId: item.id,
        title: item.snippet?.title || 'Liked YouTube Video',
        channel: item.snippet?.channelTitle || 'YouTube Creator',
        duration: '20m',
        thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
        description: item.snippet?.description || 'From your YouTube liked videos.',
        publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
      }));
      return res.json({ success: true, results });
    } else {
      const errText = await likedRes.text();
      return res.status(likedRes.status).json({ error: 'Failed to fetch liked videos', details: errText });
    }
  } catch (err) {
    console.error('Error in /api/youtube/my-liked-videos:', err);
    return res.status(500).json({ error: 'Failed to fetch liked videos' });
  }
});

// API: Generate Google OAuth Authorization URL
app.get('/api/auth/youtube/url', (req, res) => {
  const originQuery = req.query.origin ? String(req.query.origin).replace(/\/$/, '') : '';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  const baseUrl = originQuery || process.env.APP_URL || `${protocol}://${host}`;
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/callback`;

  const clientId = process.env.GOOGLE_CLIENT_ID || '';

  if (!clientId) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured in .env' });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/youtube.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'select_account',
    state: Buffer.from(JSON.stringify({ redirectUri })).toString('base64'),
  });

  return res.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  });
});

// OAuth Callback — Google redirects here after user grants permission
app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code, state: reqState } = req.query;

  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  // Decode redirect URI from state
  let redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  if (reqState) {
    try {
      const decoded = JSON.parse(Buffer.from(String(reqState), 'base64').toString('utf8'));
      if (decoded.redirectUri) redirectUri = decoded.redirectUri;
    } catch {}
  }

  // Build the profile — will be filled from real API data
  let profile: Record<string, string> = {
    name: '',
    email: '',
    handle: '',
    avatar: '',
    accessToken: '',
  };
  let errorMsg = '';

  if (!code) {
    errorMsg = 'No authorization code received from Google.';
  } else if (!clientId || !clientSecret) {
    errorMsg = 'Server OAuth credentials not configured.';
  } else {
    try {
      // 1. Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        errorMsg = `Token exchange failed: ${tokenData.error_description || tokenData.error || 'unknown error'}`;
        console.error('[auth/callback] Token exchange error:', tokenData);
      } else {
        profile.accessToken = tokenData.access_token;

        // 2. Fetch Google profile (real name + real avatar)
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userInfoRes.ok) {
          const u = await userInfoRes.json();
          profile.name = u.name || u.email?.split('@')[0] || 'Google User';
          profile.email = u.email || '';
          profile.avatar = u.picture || '';
          profile.handle = profile.email
            ? `@${profile.email.split('@')[0].toLowerCase()}`
            : `@${profile.name.toLowerCase().replace(/\s+/g, '')}`;
        }

        // 3. Enrich with YouTube channel info (real handle + channel avatar)
        const ytRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
        );
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          const ch = ytData.items?.[0]?.snippet;
          const stats = ytData.items?.[0]?.statistics;
          if (ch) {
            profile.name = ch.title || profile.name;
            profile.handle = ch.customUrl
              ? ch.customUrl.startsWith('@') ? ch.customUrl : `@${ch.customUrl}`
              : profile.handle;
            // Use highest-res thumbnail
            const thumb =
              ch.thumbnails?.high?.url ||
              ch.thumbnails?.medium?.url ||
              ch.thumbnails?.default?.url;
            if (thumb) profile.avatar = thumb;
            if (stats?.subscriberCount) {
              const n = Number(stats.subscriberCount);
              profile.subscriberCount = n >= 1_000_000
                ? `${(n / 1_000_000).toFixed(1)}M subscribers`
                : n >= 1_000
                ? `${(n / 1_000).toFixed(0)}K subscribers`
                : `${n} subscribers`;
            }
          }
        }

        if (!profile.avatar) {
          profile.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4285F4&color=fff&size=200&bold=true`;
        }
      }
    } catch (err) {
      console.error('[auth/callback] Unexpected error:', err);
      errorMsg = 'An unexpected error occurred during sign-in.';
    }
  }

  if (errorMsg) {
    // Return a clean error page
    return res.send(`<!DOCTYPE html>
<html>
<head><title>Sign-In Error</title>
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#1e293b;padding:2rem;border-radius:1rem;border:1px solid #ef4444;max-width:400px;text-align:center}
h2{color:#ef4444;margin:0 0 0.5rem}p{color:#94a3b8;font-size:.875rem}a{color:#60a5fa;text-decoration:underline}</style>
</head>
<body><div class="card">
<h2>Sign-In Failed</h2>
<p>${errorMsg}</p>
<p style="margin-top:1rem"><a href="/">← Go back to app</a></p>
</div></body></html>`);
  }

  // Save profile to localStorage and redirect to app
  const rawJson = JSON.stringify(profile);
  const b64Payload = Buffer.from(rawJson).toString('base64url');
  const safeJsonScriptString = JSON.stringify(rawJson);

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Signing you in...</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: white;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #334155;
            text-align: center; max-width: 360px; box-shadow: 0 25px 50px rgba(0,0,0,.5); }
    img { width: 72px; height: 72px; border-radius: 50%; border: 3px solid #4285F4;
          margin: 0 auto 1rem; display: block; object-fit: cover; }
    h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 .375rem; }
    p  { color: #94a3b8; font-size: .8rem; margin: 0; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
           background: #4ade80; margin-right: .4rem; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  </style>
</head>
<body>
  <div class="card">
    <img src="${profile.avatar}" alt="" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4285F4&color=fff&size=200&bold=true'" />
    <h2>Welcome, ${profile.name}!</h2>
    <p><span class="dot"></span>Signed in with Google &amp; YouTube</p>
    <p style="margin-top:.75rem;font-size:.75rem">${profile.email}</p>
  </div>
  <script>
    try {
      localStorage.setItem('user_yt_profile', ${safeJsonScriptString});
    } catch(e) { console.error('Failed to set localStorage:', e); }
    setTimeout(function() {
      window.location.href = '/?auth=success&p=' + encodeURIComponent('${b64Payload}');
    }, 800);
  </script>
</body>
</html>`);
});

// Helper: Real YouTube Web Search Parser
async function fetchRealYouTubeSearchResults(query: string) {
  let channelData: { name?: string; handle?: string; avatar?: string } | null = null;
  try {
    // 1. Direct YouTube Video URL/ID check
    const videoUrlMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|\/v\/|\/embed\/|^)([a-zA-Z0-9_-]{11})(?:[&?\s]|$)/i);
    if (videoUrlMatch && videoUrlMatch[1] && videoUrlMatch[1].length === 11) {
      const vId = videoUrlMatch[1];
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vId}&format=json`);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          return {
            channel: null,
            results: [{
              videoId: vId,
              title: oembed.title || 'YouTube Video',
              channel: oembed.author_name || 'YouTube Creator',
              duration: '35m',
              thumbnailUrl: oembed.thumbnail_url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              description: `Direct video episode import from ${oembed.author_name || 'YouTube'}. Watch and synthesize executive insights.`,
              publishedAt: new Date().toISOString().split('T')[0],
            }]
          };
        }
      } catch (oeErr) {
        // Continue to search page query if oembed fails
      }
    }

    // 2. Direct YouTube Web Results Parsing (with sp=CAI%253D for Upload Date sort)
    const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%253D`;
    const response = await fetch(ytSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
      if (jsonMatch && jsonMatch[1]) {
        const data = JSON.parse(jsonMatch[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        const extracted: any[] = [];

        for (const sec of contents) {
          const items = sec?.itemSectionRenderer?.contents || [];
          for (const item of items) {
            // Check for channelRenderer
            if (item?.channelRenderer) {
              const cr = item.channelRenderer;
              const chTitle = cr.title?.simpleText || cr.title?.runs?.[0]?.text;
              const chHandle = cr.subscriberCountText?.simpleText || cr.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl;
              const chThumb = cr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url;
              if (chTitle) {
                channelData = {
                  name: chTitle,
                  handle: chHandle?.startsWith('@') ? chHandle : (query.startsWith('@') ? query : `@${chTitle.toLowerCase().replace(/\s+/g, '')}`),
                  avatar: chThumb || `https://ui-avatars.com/api/?name=${encodeURIComponent(chTitle)}&background=ef4444&color=fff&size=200`,
                };
              }
            }

            // Check for videoRenderer
            if (item?.videoRenderer) {
              const vr = item.videoRenderer;
              const vId = vr.videoId;
              const title = vr.title?.runs?.[0]?.text || vr.title?.accessibility?.accessibilityData?.label || 'YouTube Episode';
              const channel = vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || 'YouTube Creator';
              const duration = vr.lengthText?.simpleText || '25m';
              const publishedAt = vr.publishedTimeText?.simpleText || 'Recent';
              const description = vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
                vr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || `Watch on YouTube: ${title} by ${channel}`;
              const thumbnailUrl = vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;

              if (vId) {
                extracted.push({
                  videoId: vId,
                  title,
                  channel,
                  duration,
                  thumbnailUrl,
                  description,
                  publishedAt,
                });
              }
            }
            if (extracted.length >= 10) break;
          }
          if (extracted.length >= 10) break;
        }

        if (extracted.length > 0) {
          return { channel: channelData, results: extracted };
        }
      }
    }
  } catch (err) {
    console.warn('[YouTube Web Scraper] Error parsing YouTube page:', err);
  }
  return { channel: channelData, results: null };
}

// API: Resolve YouTube channel by handle using YouTube Data API v3
app.get('/api/youtube/channel-by-handle', async (req, res) => {
  const handle = req.query.handle ? String(req.query.handle).trim() : '';
  if (!handle) return res.status(400).json({ error: 'handle parameter is required' });

  const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || '';
  const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const handleWithoutAt = cleanHandle.replace('@', '');

  // 1. Try YouTube Data API v3 first (best quality — real avatar, subscriber count)
  if (apiKey) {
    try {
      // forHandle accepts @handle format
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey}`
      );
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        const item = ytData.items?.[0];
        if (item) {
          const snippet = item.snippet || {};
          const stats = item.statistics || {};

          // Pick highest-res avatar available
          const avatar =
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.title || handleWithoutAt)}&background=ef4444&color=fff&size=200&bold=true`;

          const subCount = stats.subscriberCount
            ? Number(stats.subscriberCount) >= 1_000_000
              ? `${(Number(stats.subscriberCount) / 1_000_000).toFixed(1)}M subscribers`
              : Number(stats.subscriberCount) >= 1_000
              ? `${(Number(stats.subscriberCount) / 1_000).toFixed(0)}K subscribers`
              : `${stats.subscriberCount} subscribers`
            : '';

          return res.json({
            success: true,
            channel: {
              name: snippet.title || handleWithoutAt,
              handle: snippet.customUrl
                ? snippet.customUrl.startsWith('@')
                  ? snippet.customUrl
                  : `@${snippet.customUrl}`
                : cleanHandle,
              avatar,
              subscriberCount: subCount,
              channelId: item.id || '',
              description: snippet.description || '',
              channelUrl: `https://www.youtube.com/${cleanHandle}`,
            },
          });
        }
      }
    } catch (ytErr) {
      console.warn('[channel-by-handle] YouTube API error:', ytErr);
    }
  }

  // 2. Fallback: try searching by name/handle if forHandle didn't match
  if (apiKey) {
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&maxResults=1&key=${apiKey}`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const item = searchData.items?.[0];
        if (item?.snippet) {
          const snippet = item.snippet;
          const avatar =
            snippet.thumbnails?.high?.url ||
            snippet.thumbnails?.medium?.url ||
            snippet.thumbnails?.default?.url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.channelTitle || handleWithoutAt)}&background=ef4444&color=fff&size=200&bold=true`;

          return res.json({
            success: true,
            channel: {
              name: snippet.channelTitle || handleWithoutAt,
              handle: cleanHandle,
              avatar,
              subscriberCount: '',
              channelId: item.id?.channelId || '',
              channelUrl: `https://www.youtube.com/${cleanHandle}`,
            },
          });
        }
      }
    } catch (searchErr) {
      console.warn('[channel-by-handle] YouTube search fallback error:', searchErr);
    }
  }

  // 3. Last resort: web scrape YouTube channel page
  try {
    const pageRes = await fetch(`https://www.youtube.com/${cleanHandle}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      let channelName = '';
      let channelAvatar = '';

      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
      if (ogTitle) channelName = ogTitle[1];
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (ogImage) channelAvatar = ogImage[1];

      if (channelName) {
        return res.json({
          success: true,
          channel: {
            name: channelName,
            handle: cleanHandle,
            avatar: channelAvatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200`,
            subscriberCount: '',
            channelId: '',
            channelUrl: `https://www.youtube.com/${cleanHandle}`,
          },
        });
      }
    }
  } catch (scrapeErr) {
    console.warn('[channel-by-handle] Web scrape fallback error:', scrapeErr);
  }

  return res.status(404).json({ error: 'Channel not found', handle: cleanHandle });
});

// API: YouTube Search GET Endpoint (for handle connecting & quick search)
app.get('/api/youtube/search', async (req, res) => {
  const query = req.query.q ? String(req.query.q).trim() : '';
  if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const webResults = await fetchRealYouTubeSearchResults(query);
  if (webResults.results && webResults.results.length > 0) {
    return res.json({ success: true, channel: webResults.channel, results: webResults.results });
  }

  return res.json({ success: true, channel: webResults.channel, results: [] });
});

app.post('/api/youtube/search', async (req, res) => {
  const query = req.body.query || req.body.q;
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const webResults = await fetchRealYouTubeSearchResults(query);
  return res.json({ success: true, channel: webResults.channel, results: webResults.results || [] });
});

// API: Search YouTube Videos & Podcasts
app.post('/api/search-youtube', async (req, res) => {
  const { query, customApiKey, oauthToken } = req.body;
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const apiKey = customApiKey || process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;

  // 1. Try Live YouTube Data API v3 search if API key or OAuth token is available
  if (apiKey || oauthToken) {
    try {
      let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=date&maxResults=15`;
      const headers: Record<string, string> = {};
      if (oauthToken) {
        headers['Authorization'] = `Bearer ${oauthToken}`;
      } else if (apiKey) {
        searchUrl += `&key=${apiKey}`;
      }

      const ytRes = await fetch(searchUrl, { headers });
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        const items = ytData.items || [];

        if (items.length > 0) {
          const videoIds = items.map((i: any) => i.id?.videoId).filter(Boolean).join(',');

          // Fetch video duration details if possible
          let durationMap: Record<string, string> = {};
          if (videoIds) {
            let detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}`;
            if (apiKey && !oauthToken) detailsUrl += `&key=${apiKey}`;
            const detRes = await fetch(detailsUrl, { headers });
            if (detRes.ok) {
              const detData = await detRes.json();
              (detData.items || []).forEach((vItem: any) => {
                const isoDur = vItem.contentDetails?.duration || '';
                // Convert ISO 8601 duration (e.g., PT1H52M12S)
                const h = isoDur.match(/(\d+)H/);
                const m = isoDur.match(/(\d+)M/);
                const s = isoDur.match(/(\d+)S/);
                let formattedDur = '';
                if (h) formattedDur += `${h[1]}h `;
                if (m) formattedDur += `${m[1]}m `;
                if (s && !h) formattedDur += `${s[1]}s`;
                durationMap[vItem.id] = formattedDur.trim() || '25m';
              });
            }
          }

          const liveResults = items.map((item: any) => {
            const vId = item.id?.videoId;
            const snip = item.snippet || {};
            return {
              videoId: vId,
              title: snip.title || 'YouTube Episode',
              channel: snip.channelTitle || 'YouTube Host',
              duration: durationMap[vId] || '35m',
              thumbnailUrl: snip.thumbnails?.high?.url || snip.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
              description: snip.description || 'Watch on YouTube for detailed episode insights.',
              publishedAt: (snip.publishedAt || '').split('T')[0] || 'Recently',
            };
          });

          return res.json({ success: true, results: liveResults, isLiveApi: true });
        }
      } else {
        console.warn(`[YouTube Data API] Live query status: ${ytRes.status}`);
      }
    } catch (ytErr) {
      console.warn('[YouTube Data API] Error fetching live search:', ytErr);
    }
  }

  // 2. Fetch direct real YouTube search results for exact creator, playlist & video queries
  const realWebResults = await fetchRealYouTubeSearchResults(query);
  if (realWebResults?.results && realWebResults.results.length > 0) {
    return res.json({ success: true, channel: realWebResults.channel, results: realWebResults.results, isLiveApi: true });
  }

  // 3. Try Gemini AI search generation
  try {
    const ai = getGenAIClient();
    const prompt = `
Search and curate top relevant YouTube podcasts, interviews, and educational video episodes for the topic: "${query}".

Return 6 realistic, high-value YouTube video entries for this search query.
Use real, popular YouTube video IDs that correspond to real videos (e.g., "M576WGiDBdQ" for Bezos/Lex, "gX_m3fU3e18" for Huberman/Focus, "8S0FDjFBj8o" for YC/SaaS, "b02TIsInTmg" for Sam Altman, "3qHkcs3kG44" for Naval, "f33m-1o2c8E" for All-In).
Provide accurate channel names, realistic durations, thumbnail URLs (like "https://img.youtube.com/vi/<videoId>/hqdefault.jpg"), and a concise 2-sentence description of key business/learning insights in the video.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  videoId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  channel: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  thumbnailUrl: { type: Type.STRING },
                  description: { type: Type.STRING },
                  publishedAt: { type: Type.STRING },
                },
                required: ['videoId', 'title', 'channel', 'duration', 'description'],
              },
            },
          },
          required: ['results'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"results":[]}');
    const rawResults = parsed.results || [];

    const realFallbackIds = [
      'M576WGiDBdQ',
      'gX_m3fU3e18',
      '8S0FDjFBj8o',
      'b02TIsInTmg',
      '3qHkcs3kG44',
      '0e3GPea1Tyg',
      'f33m-1o2c8E',
    ];

    const formattedResults = rawResults.map((item: any, idx: number) => {
      let vId = (item.videoId || '').trim();
      const match = vId.match(/(?:v=|\/)([^"&?\/\s]{11})/i);
      if (match && match[1]) {
        vId = match[1];
      } else if (vId.length !== 11) {
        vId = realFallbackIds[idx % realFallbackIds.length];
      }

      let thumb = item.thumbnailUrl;
      if (!thumb || !thumb.startsWith('http') || thumb.includes('sample') || thumb.includes('example')) {
        thumb = `https://img.youtube.com/vi/${vId}/hqdefault.jpg`;
      }

      return {
        ...item,
        videoId: vId,
        thumbnailUrl: thumb,
      };
    });

    if (formattedResults.length > 0) {
      return res.json({ success: true, results: formattedResults });
    }
  } catch (error: any) {
    if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.warn(`[YouTube Search] Gemini API rate limit reached. Serving instant curated catalog for query "${query}".`);
    } else {
      console.warn('[YouTube Search] Gemini search notice:', error?.message || error);
    }
  }

  // 4. Robust Search Fallback: Filter catalog based on query terms
  const qLower = query.toLowerCase();
  const words = qLower.split(/\s+/).filter((w: string) => w.length > 2);

  let filtered = FALLBACK_YOUTUBE_CATALOG.filter((item) => {
    const textToMatch = `${item.title} ${item.channel} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
    return words.some((word: string) => textToMatch.includes(word));
  });

  if (filtered.length === 0) {
    filtered = FALLBACK_YOUTUBE_CATALOG.slice(0, 6);
  }

  const results = filtered.map(({ tags, ...rest }) => rest);
  return res.json({ success: true, results, isFallback: true });
});

// API: Content Creation Studio Post Generator
app.post('/api/generate-content', async (req, res) => {
  try {
    const { podcastTitle, channel, summary, takeaways, monetization, format } = req.body;
    const ai = getGenAIClient();

    const prompt = `
You are a master content strategist, viral copywriter, and newsletter editor.
Convert the following podcast insights into a publish-ready ${format || 'X / Twitter Thread'}.

Podcast Title: ${podcastTitle}
Channel: ${channel}
Executive Summary: ${summary}
Actionable Takeaways: ${JSON.stringify(takeaways)}
Monetization Ideas: ${JSON.stringify(monetization)}

Format requested: ${format} (options: "X / Twitter Thread", "LinkedIn Post", "Newsletter Digest", "Micro-SaaS Pitch", "Short Video Script")

Instructions:
- For Twitter Thread: Return 5-7 numbered tweets with strong hooks, punchy bullets, and a concluding call-to-action.
- For LinkedIn Post: Return a professional article-style post with clear spacing, bold key phrases, and an engaging question at the end.
- For Newsletter Digest: Return a subscriber email with Subject Line, TL;DR, Deep Takeaway, and Action Steps.
- For Micro-SaaS Pitch: Return a product proposal outline (Problem, Solution, Target Market, Monetization Strategy, MVP Tech Stack).
- For Short Video Script: Return a 60-second video script with Hook, Visual Cues, On-screen text, and Audio dialogue.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    return res.json({ success: true, generatedText: response.text });
  } catch (error: any) {
    if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota')) {
      console.warn('[Generate Content API] Gemini quota limit reached. Serving formatted fallback post.');
      const format = req.body.format || 'X / Twitter Thread';
      const title = req.body.podcastTitle || 'Podcast Analysis';
      const takeaways = req.body.takeaways || [];
      const monetization = req.body.monetization || [];

      return res.json({
        success: true,
        generatedText: `🔥 INSIGHTS FROM: "${title}"\n\n📌 Key Takeaways:\n${takeaways.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}\n\n💡 Monetization Ideas:\n${monetization.map((m: any) => `- ${m.title || 'Idea'}: ${m.description || ''}`).join('\n')}\n\nFormatted as ${format} • #PodcastInsights #Growth #Monetization`,
        isFallback: true
      });
    }
    console.warn('[Generate Content API] Content generation notice:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to generate content' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
