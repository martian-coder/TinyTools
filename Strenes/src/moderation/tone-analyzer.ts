import type { ToneAnalysis, MessageTone } from '../types';

// Keywords for tone detection
const TONE_KEYWORDS = {
  polite: [
    'please', 'thank', 'appreciate', 'sorry', 'apologies', 'excuse me',
    'kindly', 'would you mind', 'could you', 'would appreciate', 'grateful',
    'thanks', 'love to', 'looking forward', 'hope you', 'cheers', '😊', '🙏', '❤️'
  ],
  aggressive: [
    'hate', 'stupid', 'idiot', 'dumb', 'awful', 'terrible', 'disgusting',
    'unacceptable', 'ridiculous', 'pathetic', 'useless', 'worthless',
    'fuck', 'shit', 'ass', 'damn', '😤', '😡', '🤬'
  ],
  assertive: [
    'need', 'must', 'should', 'have to', 'important', 'urgent', 'critical',
    'required', 'essential', 'necessary', 'demand', 'expect', 'insist'
  ],
  harsh: [
    'never', 'always', 'obviously', 'clearly', 'seriously', 'honestly',
    'unbelievable', 'appalling', 'disgusted', 'sick of', 'fed up', 'enough'
  ]
};

export function analyzeTone(text: string): ToneAnalysis {
  if (!text.trim()) {
    return { tone: 'neutral', confidence: 0.8, mightCauseAnxiety: false };
  }

  const lowerText = text.toLowerCase();
  const scores: Record<MessageTone, number> = {
    polite: 0,
    neutral: 0,
    assertive: 0,
    aggressive: 0,
    harsh: 0
  };

  // Count keyword matches
  Object.entries(TONE_KEYWORDS).forEach(([tone, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword)) {
        scores[tone as MessageTone] += 1;
      }
    });
  });

  // Analyze punctuation
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;

  if (exclamationCount > 3 && capsRatio > 0.3) {
    scores.aggressive += 2;
  }
  if (questionCount > 2) {
    scores.polite += 0.5;
  }

  // Emoji analysis
  const positiveEmojis = ['😊', '🙂', '😂', '❤️', '👍', '🎉', '✨', '🙏'];
  const negativeEmojis = ['😤', '😡', '🤬', '😠', '💢', '🖕'];

  positiveEmojis.forEach(emoji => {
    if (text.includes(emoji)) scores.polite += 0.5;
  });
  negativeEmojis.forEach(emoji => {
    if (text.includes(emoji)) scores.aggressive += 1;
  });

  // Determine dominant tone
  const maxScore = Math.max(...Object.values(scores));
  let tone: MessageTone = 'neutral';
  let confidence = 0.6;

  if (maxScore > 0) {
    const tones = Object.entries(scores)
      .filter(([_, s]) => s === maxScore)
      .map(([t]) => t as MessageTone);
    tone = tones[0];
    confidence = Math.min(0.95, 0.5 + (maxScore / 10));
  }

  // Check if might cause anxiety
  const mightCauseAnxiety =
    (tone === 'aggressive' || tone === 'harsh') && confidence > 0.6;

  // Suggestion
  let suggestion = '';
  if (tone === 'aggressive' && confidence > 0.7) {
    suggestion = 'This might come across as harsh. Consider softening the tone?';
  } else if (tone === 'harsh' && confidence > 0.7) {
    suggestion = 'Very strong language detected. Recipients might be hurt.';
  } else if (tone === 'assertive' && confidence > 0.7 && text.includes('must')) {
    suggestion = 'Sounds firm. Make sure the recipient won\'t feel pressured.';
  }

  return {
    tone,
    confidence: Math.round(confidence * 100) / 100,
    mightCauseAnxiety,
    suggestion
  };
}

export function getToneColor(tone: MessageTone): string {
  switch (tone) {
    case 'polite':
      return '#34d399'; // green
    case 'neutral':
      return '#94a3b8'; // gray
    case 'assertive':
      return '#f59e0b'; // amber
    case 'aggressive':
      return '#f97316'; // orange
    case 'harsh':
      return '#ef4444'; // red
    default:
      return '#94a3b8';
  }
}

export function getToneEmoji(tone: MessageTone): string {
  switch (tone) {
    case 'polite':
      return '😊';
    case 'neutral':
      return '😐';
    case 'assertive':
      return '💪';
    case 'aggressive':
      return '😤';
    case 'harsh':
      return '😠';
    default:
      return '❓';
  }
}
