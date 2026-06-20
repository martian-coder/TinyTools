import type { ModerationVerdict, UserSettings, RouteResult } from '../types';

export function routeVerdict(verdict: ModerationVerdict, settings: UserSettings, trusted: boolean): RouteResult {
  if (trusted) return { folder: 'primary', status: 'delivered' };

  if (verdict.category === 'abusive') {
    if (!settings.civility.enabled) return { folder: 'primary', status: 'delivered' };
    const autoReply = settings.civility.notifySender;
    if (settings.civility.onBlock === 'silentDrop') return { folder: 'review', status: 'dropped', autoReply };
    return { folder: 'review', status: 'held', ask: settings.civility.onBlock === 'askPerMessage', autoReply };
  }

  if (verdict.category === 'spam') {
    if (!settings.spam.enabled) return { folder: 'promotions', status: 'delivered' };
    if (settings.spam.onBlock === 'silentDrop') return { folder: 'review', status: 'dropped' };
    return { folder: 'review', status: 'held' };
  }

  if (verdict.category === 'business')
    return { folder: settings.business.enabled ? 'business' : 'primary', status: 'delivered' };

  if (verdict.category === 'promo')
    return { folder: 'promotions', status: 'delivered' };

  return { folder: 'primary', status: 'delivered' };
}
