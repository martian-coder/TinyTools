import type { QuickActionId, TranscriptEvent } from '../../shared/types';

/**
 * Works out what the user actually needs, so they never have to pick a mode.
 *
 * Deliberately a deterministic heuristic rather than a model call: it runs on
 * every question, must not add latency or cost, and a wrong guess should be
 * predictable enough to reason about. It only ever *biases* the prompt — the
 * assistant still has the full context either way, so a misread degrades the
 * emphasis, never the substance.
 */

export type Focus = 'documents' | 'technical' | 'reply' | 'coaching' | 'general';

/** Words that suggest the answer should come out of the attached files. */
const DOCUMENT_HINTS =
  /\b(spec|document|doc|docs|file|report|deck|slide|contract|policy|sheet|attach\w*|according to|what does it say|in the (spec|doc|report|contract))\b/i;

/** Vocabulary that means the discussion has gone into the machinery. */
const TECHNICAL_HINTS =
  /\b(api|latency|timeout|retry|retries|deploy\w*|schema|database|query|cache|throughput|endpoint|architecture|infra\w*|migration|rollback|bug|stack ?trace|exception|regression|load test|p9\d|sdk|webhook|token|auth\w*|encrypt\w*|race condition|memory leak)\b/i;

/** The user asking what to say next, rather than asking for information. */
const REPLY_HINTS =
  /\b(what (should|do) i (say|reply|respond|answer)|how (should|do) i (say|reply|respond|phrase|answer)|help me (say|reply|respond|answer)|reply to (this|that|them)|respond to (this|that|them)|what do i tell)\b/i;

export interface FocusInput {
  message: string;
  action?: QuickActionId;
  transcript?: TranscriptEvent[];
  /** True when retrieval actually found relevant chunks. */
  hasDocumentContext?: boolean;
}

export function detectFocus(input: FocusInput): Focus {
  // An explicit quick action is a direct statement of intent; never override it.
  if (input.action === 'critique' || input.action === 'quiz-me') return 'coaching';
  if (input.action === 'suggest-reply') return 'reply';

  const message = input.message ?? '';
  if (REPLY_HINTS.test(message)) return 'reply';

  // Asking *about* the documents beats merely having some attached.
  if (DOCUMENT_HINTS.test(message)) return 'documents';

  if (TECHNICAL_HINTS.test(message)) return 'technical';

  // Nothing in the question itself, so read the room: if the discussion has
  // been technical, an ambiguous question probably is too.
  const recent = (input.transcript ?? [])
    .slice(-6)
    .map((line) => line.text)
    .join(' ');
  if (recent && TECHNICAL_HINTS.test(recent)) return 'technical';

  // Documents were retrieved and nothing else claimed the question: ground
  // the answer in them rather than answering from thin air.
  if (input.hasDocumentContext) return 'documents';

  return 'general';
}

/**
 * The extra paragraph appended to the auto prompt. Kept short — this steers
 * emphasis, it does not restate the rules the base prompt already carries.
 */
export function focusGuidance(focus: Focus): string {
  switch (focus) {
    case 'documents':
      return `This question is about the attached material. Answer from it and cite
every claim as [file name, p.N] or [file name, Section]. If the documents do not
cover it, say so plainly in one line, then answer from the discussion if you can
and mark that clearly as coming from the discussion rather than the documents.`;

    case 'technical':
      return `The discussion is technical. Explain the mechanism rather than the
label, name the tradeoff, and flag the failure mode nobody has raised. Define any
jargon in plain words the first time it appears. If a number matters (a timeout,
a limit, a latency), state it.`;

    case 'reply':
      return `The user wants something to say out loud, right now. Give one or two
sentences they can speak as-is: direct, courteous, no throat-clearing. Add one
alternative phrasing if a softer or firmer version would help. Do not explain the
reasoning unless it is one short line.`;

    case 'coaching':
      return `The user is rehearsing. Critique what they actually said, quoting the
weak phrase. Lead with what worked, briefly, then the one or two things to fix,
then a tighter rewrite. Be direct and warm; this is practice, not assessment.`;

    default:
      return `The topic may be new to the user — a new client, a new manager, an
unfamiliar assignment. Give them footing: what is actually being asked, what it
implies, what they should confirm before committing. Where you are inferring
rather than repeating something said, say so. If a decision is being made without
a stated owner or date, point that out.`;
  }
}

/** Shown in the overlay so the routing is never a black box. */
export const FOCUS_LABELS: Record<Focus, string> = {
  documents: 'documents',
  technical: 'technical',
  reply: 'reply',
  coaching: 'coaching',
  general: 'general',
};
