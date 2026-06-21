export type NetworkRoute = 'ip' | 'sms' | 'queue';

export function getNetworkRoute(): NetworkRoute {
  if (navigator.onLine) return 'ip';
  // Network Information API: if phone has cellular signal but no data, SMS is possible
  const conn = (navigator as any).connection
    ?? (navigator as any).mozConnection
    ?? (navigator as any).webkitConnection;
  if (conn?.type === 'cellular') return 'sms';
  return 'queue';
}
