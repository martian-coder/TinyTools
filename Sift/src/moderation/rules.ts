import type { ModerationVerdict, UserSettings } from '../types';

const ABUSIVE  = ['idiot','stupid','hate you','shut up','loser','moron','trash','kill','dumb','worthless'];
const SPAM     = ['forwarded','share with','forward to','10 people','10 friends','click here','good luck','bad luck','win free','http'];
const BUSINESS = ['order','invoice','otp','delivery','tracking','shipped','payment','receipt','appointment','booking'];
const PROMO    = ['sale','discount','% off','offer','deal','coupon','limited time','buy now','free shipping'];

export function moderate(text: string, settings: UserSettings): ModerationVerdict {
  const t = text.toLowerCase();
  const hit = (list: string[]) => list.filter(w => t.includes(w));

  const ab = hit(ABUSIVE);
  if (settings.civility.enabled && ab.length) {
    const base = settings.civility.sensitivity === 'high' ? 0.70 : settings.civility.sensitivity === 'low' ? 0.55 : 0.62;
    return { category: 'abusive', confidence: Math.min(0.97, base + ab.length * 0.12), flaggedTerms: ab, engine: 'rules' };
  }

  const sp = hit(SPAM);
  const emoji = (t.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length >= 3;
  const shout = text.replace(/[^A-Z]/g, '').length > 8 && text === text.toUpperCase();
  if (settings.spam.enabled && (sp.length || emoji || shout))
    return { category: 'spam', confidence: Math.min(0.96, 0.6 + (sp.length + (emoji ? 1 : 0)) * 0.12), flaggedTerms: sp, engine: 'rules' };

  const bz = hit(BUSINESS);
  if (settings.business.enabled && bz.length)
    return { category: 'business', confidence: Math.min(0.95, 0.62 + bz.length * 0.1), flaggedTerms: bz, engine: 'rules' };

  const pr = hit(PROMO);
  if (pr.length)
    return { category: 'promo', confidence: Math.min(0.95, 0.6 + pr.length * 0.1), flaggedTerms: pr, engine: 'rules' };

  return { category: 'clean', confidence: 0.92, flaggedTerms: [], engine: 'rules' };
}
