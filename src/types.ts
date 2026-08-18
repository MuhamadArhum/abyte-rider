export type VehicleType = 'bike' | 'car' | 'van' | 'bicycle' | 'scooter';
export type RiderStatus = 'online' | 'moving' | 'idle' | 'offline' | 'emergency';

export interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

export interface BreadcrumbPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  heading: number;
  address?: string;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  vehicleType: VehicleType;
  vehiclePlate: string;
  status: RiderStatus;
  location: LocationCoords;
  heading: number;
  speed: number;
  batteryLevel: number;
  accuracy: number;
  lastPing: string;
  todayDistanceKm: number;
  maxSpeedToday?: number;
  stoppedDurationMinutes?: number;
  rating: number;
  city: string;
  isSimulated?: boolean;
  history?: BreadcrumbPoint[];
  nudged?: boolean;
  trackingLink?: string;
}

export type AlertType = 'sos' | 'speeding' | 'idle' | 'low_battery' | 'geofence_breach' | 'device_offline';

export interface FleetAlert {
  id: string;
  riderId: string;
  riderName: string;
  type: AlertType;
  message: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  resolved: boolean;
  location: LocationCoords;
}

export interface FleetStats {
  totalRiders: number;
  onlineRiders: number;
  movingRiders: number;
  idleRiders: number;
  offlineRiders: number;
  activeAlerts: number;
  totalDistanceKm: number;
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: LocationCoords;
  radiusMeters: number;
  color: string;
}
