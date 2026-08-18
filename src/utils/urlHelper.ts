/**
 * Utility to generate public, shareable tracking URLs for riders.
 * Converts development URLs (ais-dev-*) into public shared URLs (ais-pre-*)
 * so external phone browsers do not get HTTP 403 Forbidden (IAM permission errors).
 */
export function getShareableRiderUrl(riderId: string): string {
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  return `${origin}/?rider=${encodeURIComponent(riderId)}`;
}
