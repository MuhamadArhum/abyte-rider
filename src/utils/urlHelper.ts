/**
 * Utility to generate tracking URLs and QR codes for riders.
 */

// Direct link using the exact current environment URL
export function getDirectRiderUrl(riderId: string, name?: string, plate?: string): string {
  const origin = window.location.origin;
  const params = new URLSearchParams();
  params.set('rider', riderId);
  if (name) params.set('name', name);
  if (plate) params.set('plate', plate);
  return `${origin}/?${params.toString()}`;
}

// Public link (converts ais-dev-* to ais-pre-*)
export function getPublicRiderUrl(riderId: string, name?: string, plate?: string): string {
  let origin = window.location.origin;
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }
  const params = new URLSearchParams();
  params.set('rider', riderId);
  if (name) params.set('name', name);
  if (plate) params.set('plate', plate);
  return `${origin}/?${params.toString()}`;
}

// Smart default: returns direct URL
export function getShareableRiderUrl(riderId: string, name?: string, plate?: string): string {
  return getDirectRiderUrl(riderId, name, plate);
}

// Generate high-resolution QR code URL for instant mobile camera scanning
export function getQrCodeUrl(url: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=8`;
}
