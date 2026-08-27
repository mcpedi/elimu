export const NOTIFICATION_REFRESH_INTERVAL_MS = 10_000;

export function notificationBadgeLabel(count: number) {
  return count > 9 ? "9+" : String(Math.max(0, count));
}
