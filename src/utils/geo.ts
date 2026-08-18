import { LocationCoords } from '../types';

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function formatTimeAgo(isoDateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDateString).getTime()) / 1000);
  if (seconds < 5) return 'Just now (Live)';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

export function getHeadingDirection(degree: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((degree % 360) + 360) % 360 / 45) % 8;
  return directions[index];
}

export function formatBattery(level: number): { text: string; color: string } {
  if (level > 60) return { text: `${level}%`, color: 'text-emerald-400' };
  if (level > 25) return { text: `${level}%`, color: 'text-amber-400' };
  return { text: `${level}%`, color: 'text-rose-400' };
}
