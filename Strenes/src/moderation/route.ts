import type { ModerationVerdict, UserSettings, RouteResult, Contact } from '../types';

export function isInDNDHours(settings: UserSettings): boolean {
  if (!settings.dnd.enabled) return false;
  const now = new Date();
  const hour = now.getHours();
  if (settings.dnd.startHour < settings.dnd.endHour) {
    return hour >= settings.dnd.startHour && hour < settings.dnd.endHour;
  }
  return hour >= settings.dnd.startHour || hour < settings.dnd.endHour;
}

export function canReceiveInDND(contact: Contact, settings: UserSettings): boolean {
  if (!isInDNDHours(settings)) return true;
  if (contact.isEmergency && settings.dnd.allowEmergency) return true;
  if (contact.trusted && settings.dnd.allowTrusted) return true;
  return false;
}

export function routeVerdict(verdict: ModerationVerdict, settings: UserSettings, trusted: boolean, contact?: Contact): RouteResult {
  // Unhinged mode: bypass all filters
  if (settings.unhingedMode.enabled) {
    return { folder: 'primary', status: 'delivered' };
  }

  // Check DND
  if (contact && !canReceiveInDND(contact, settings)) {
    if (settings.dnd.notifyButSilent) {
      return { folder: 'primary', status: 'delivered' };
    }
    return { folder: 'primary', status: 'held' };
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
