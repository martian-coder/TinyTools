import type { ModerationVerdict, UserSettings, RouteResult } from '../types';

export function routeVerdict(
  verdict: ModerationVerdict,
  settings: UserSettings,
  trusted: boolean,
): RouteResult {
  // Trusted contacts bypass all filters
  if (trusted) {
    return { folder: 'primary', status: 'delivered' };
  }

  const { category } = verdict;

  if (category === 'clean') {
    return { folder: 'primary', status: 'delivered' };
  }

  if (category === 'abusive' && settings.civility.enabled) {
    const action = settings.civility.onBlock;
    const senderMsg = settings.civility.notifySender
      ? `[Auto] This person doesn't accept messages with abusive language.`
      : undefined;

    if (action === 'silentDrop') {
      return { folder: 'review', status: 'dropped', autoReply: senderMsg };
    }
    if (action === 'askPerMessage') {
      return { folder: 'review', status: 'held', autoReply: senderMsg, ask: true };
    }
    // default: review
    return { folder: 'review', status: 'held', autoReply: senderMsg };
  }

  if (category === 'spam' && settings.spam.enabled) {
    const action = settings.spam.onBlock;
    if (action === 'silentDrop') {
      return { folder: 'review', status: 'dropped' };
    }
    return { folder: 'review', status: 'held' };
  }

  if (category === 'business' && settings.business.enabled) {
    return { folder: 'business', status: 'delivered' };
  }

  if (category === 'promo') {
    return { folder: 'promotions', status: 'delivered' };
  }

  return { folder: 'primary', status: 'delivered' };
}
