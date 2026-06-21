import type { ModerationVerdict, UserSettings, RouteResult } from '../types';

function isDNDActive(dnd: UserSettings['dnd']): boolean {
  if (!dnd.enabled) return false;
  const hour = new Date().getHours();
  const { startHour, endHour } = dnd;
  return startHour <= endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

export function routeVerdict(
  verdict: ModerationVerdict,
  settings: UserSettings,
  trusted: boolean,
  isEmergency = false,
): RouteResult {
  // Unhinged mode bypasses all filters
  if (settings.unhingedMode.enabled) return { folder: 'primary', status: 'delivered' };

  // Emergency contacts bypass DND (if allowed) and all filters
  if (isEmergency && settings.dnd.allowEmergency) {
    return { folder: 'primary', status: 'delivered' };
  }

  // DND — block non-emergency senders during quiet hours
  if (isDNDActive(settings.dnd)) {
    if (trusted && settings.dnd.allowTrusted) {
      // fall through — trusted bypass below
    } else {
      return {
        folder: 'primary',
        status: settings.dnd.notifyButSilent ? 'held' : 'dropped',
      };
    }
  }

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
