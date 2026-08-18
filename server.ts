import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Fleet State Database
interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

interface BreadcrumbPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  heading: number;
  address?: string;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  vehicleType: 'bike' | 'car' | 'van' | 'bicycle' | 'scooter';
  vehiclePlate: string;
  status: 'online' | 'moving' | 'idle' | 'offline' | 'emergency';
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
  history: BreadcrumbPoint[];
  nudged?: boolean;
  trackingLink?: string;
}

interface FleetAlert {
  id: string;
  riderId: string;
  riderName: string;
  type: 'sos' | 'speeding' | 'idle' | 'low_battery' | 'geofence_breach' | 'device_offline';
  message: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  resolved: boolean;
  location: LocationCoords;
}

// Initial State is 100% clean (Only real riders added by user or transmitter links)
const INITIAL_RIDERS: Rider[] = [];
const INITIAL_ALERTS: FleetAlert[] = [];

let riders: Rider[] = [];
let alerts: FleetAlert[] = [];

// Background simulation ticker for simulated riders only
setInterval(() => {
  riders.forEach((rider) => {
    if (!rider.isSimulated || rider.status === 'offline') return;

    if (rider.status === 'idle') {
      rider.speed = 0;
      rider.lastPing = new Date().toISOString();
      rider.stoppedDurationMinutes = (rider.stoppedDurationMinutes || 0) + 0.1;
      return;
    }

    const speedVariation = (Math.random() - 0.5) * 6;
    rider.speed = Math.max(15, Math.min(65, Math.round(rider.speed + speedVariation)));
    if (!rider.maxSpeedToday || rider.speed > rider.maxSpeedToday) {
      rider.maxSpeedToday = rider.speed;
    }
    rider.stoppedDurationMinutes = 0;
    
    rider.heading = (rider.heading + (Math.random() - 0.5) * 25 + 360) % 360;
    
    const rad = (rider.heading * Math.PI) / 180;
    const distanceDelta = 0.00035 + Math.random() * 0.00025;
    
    const newLat = Number((rider.location.lat + Math.cos(rad) * distanceDelta).toFixed(6));
    const newLng = Number((rider.location.lng + Math.sin(rad) * distanceDelta).toFixed(6));

    rider.location.lat = newLat;
    rider.location.lng = newLng;
    rider.lastPing = new Date().toISOString();
    rider.todayDistanceKm = Number((rider.todayDistanceKm + 0.04).toFixed(2));
    
    if (Math.random() < 0.05 && rider.batteryLevel > 5) {
      rider.batteryLevel -= 1;
    }

    if (!rider.history) rider.history = [];
    rider.history.push({
      lat: newLat,
      lng: newLng,
      speed: rider.speed,
      timestamp: rider.lastPing,
      heading: rider.heading,
      address: rider.location.address,
    });
    if (rider.history.length > 100) rider.history.shift();
  });
}, 3000);

// Helper: Haversine distance in KM
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

// ----------------- API ENDPOINTS -----------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all fleet riders
app.get('/api/riders', (req, res) => {
  res.json({ success: true, riders });
});

// Register / Create a real rider
app.post('/api/riders', (req, res) => {
  const { name, phone, vehicleType, vehiclePlate, city, lat, lng, isDeviceRider } = req.body;
  const newId = `RDR-${Math.floor(1000 + Math.random() * 9000)}`;
  const newRider: Rider = {
    id: newId,
    name: name || 'New Fleet Rider',
    phone: phone || '+92 300 0000000',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    vehicleType: vehicleType || 'bike',
    vehiclePlate: vehiclePlate || `GPS-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'online',
    location: {
      lat: Number(lat) || 24.8607,
      lng: Number(lng) || 67.0011,
      address: 'Live GPS Pin',
    },
    heading: 0,
    speed: 0,
    batteryLevel: 100,
    accuracy: 3,
    lastPing: new Date().toISOString(),
    todayDistanceKm: 0,
    maxSpeedToday: 0,
    stoppedDurationMinutes: 0,
    rating: 5.0,
    city: city || 'Karachi',
    isSimulated: isDeviceRider === false ? false : false,
    history: [
      {
        lat: Number(lat) || 24.8607,
        lng: Number(lng) || 67.0011,
        speed: 0,
        timestamp: new Date().toISOString(),
        heading: 0,
      }
    ],
  };

  riders.unshift(newRider);
  res.status(201).json({ success: true, rider: newRider });
});

// Bulk Import Riders (from CSV or paste list)
app.post('/api/riders/bulk-import', (req, res) => {
  const { ridersList } = req.body;
  if (!Array.isArray(ridersList) || ridersList.length === 0) {
    return res.status(400).json({ error: 'Invalid riders list provided' });
  }

  const addedRiders: Rider[] = [];
  ridersList.forEach((item: any) => {
    const newId = `RDR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRider: Rider = {
      id: newId,
      name: item.name || 'Fleet Rider',
      phone: item.phone || '+92 300 0000000',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      vehicleType: item.vehicleType || 'bike',
      vehiclePlate: item.vehiclePlate || `KHI-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'offline',
      location: {
        lat: Number(item.lat) || 24.8607,
        lng: Number(item.lng) || 67.0011,
        address: 'Initial Base',
      },
      heading: 0,
      speed: 0,
      batteryLevel: 100,
      accuracy: 3,
      lastPing: new Date().toISOString(),
      todayDistanceKm: 0,
      maxSpeedToday: 0,
      stoppedDurationMinutes: 0,
      rating: 5.0,
      city: item.city || 'Karachi',
      isSimulated: false,
      history: [],
    };
    riders.unshift(newRider);
    addedRiders.push(newRider);
  });

  res.status(201).json({ success: true, count: addedRiders.length, riders: addedRiders });
});

// Edit Rider Details
app.put('/api/riders/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, vehicleType, vehiclePlate, city } = req.body;

  const rider = riders.find((r) => r.id === id);
  if (!rider) {
    return res.status(404).json({ error: 'Rider not found' });
  }

  if (name) rider.name = name;
  if (phone) rider.phone = phone;
  if (vehicleType) rider.vehicleType = vehicleType;
  if (vehiclePlate) rider.vehiclePlate = vehiclePlate;
  if (city) rider.city = city;

  res.json({ success: true, rider });
});

// Delete a single rider
app.delete('/api/riders/:id', (req, res) => {
  const { id } = req.params;
  const index = riders.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Rider not found' });
  }

  const deleted = riders.splice(index, 1)[0];
  alerts = alerts.filter(a => a.riderId !== id);

  res.json({ success: true, message: `Rider ${deleted.name} removed successfully` });
});

// Clear all demo riders / start 100% clean
app.delete('/api/riders-clear-all', (req, res) => {
  riders = [];
  alerts = [];
  res.json({ success: true, message: 'All riders cleared. Fleet is now clean and ready for real data.' });
});

// Continuous Live Location Ping from Rider's Phone
app.post('/api/riders/:id/location', (req, res) => {
  const { id } = req.params;
  const { lat, lng, speed, heading, accuracy, batteryLevel, address } = req.body;

  let rider = riders.find((r) => r.id === id);
  if (!rider) {
    rider = {
      id,
      name: 'Rider Device (' + id + ')',
      phone: '+92 300 1234567',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      vehicleType: 'bike',
      vehiclePlate: 'LIVE-GPS',
      status: 'moving',
      location: { lat: Number(lat), lng: Number(lng), address: address || 'Live Location' },
      heading: Number(heading) || 0,
      speed: Number(speed) || 0,
      batteryLevel: Number(batteryLevel) || 100,
      accuracy: Number(accuracy) || 5,
      lastPing: new Date().toISOString(),
      todayDistanceKm: 0,
      maxSpeedToday: Number(speed) || 0,
      stoppedDurationMinutes: 0,
      rating: 5.0,
      city: 'Live Zone',
      isSimulated: false,
      history: [],
    };
    riders.unshift(rider);
  }

  const prevLat = rider.location.lat;
  const prevLng = rider.location.lng;

  rider.location.lat = Number(lat);
  rider.location.lng = Number(lng);
  if (address) rider.location.address = address;
  if (heading !== undefined) rider.heading = Number(heading);
  if (speed !== undefined) {
    rider.speed = Number(speed);
    if (!rider.maxSpeedToday || rider.speed > rider.maxSpeedToday) {
      rider.maxSpeedToday = rider.speed;
    }
    if (rider.speed > 3) {
      rider.status = 'moving';
      rider.stoppedDurationMinutes = 0;
    } else {
      rider.status = 'idle';
      rider.stoppedDurationMinutes = (rider.stoppedDurationMinutes || 0) + 0.1;
    }
  }
  if (accuracy !== undefined) rider.accuracy = Number(accuracy);
  if (batteryLevel !== undefined) rider.batteryLevel = Number(batteryLevel);
  rider.lastPing = new Date().toISOString();

  // Accumulate distance
  if (prevLat && prevLng && (prevLat !== Number(lat) || prevLng !== Number(lng))) {
    const dist = getDistanceKm(prevLat, prevLng, Number(lat), Number(lng));
    if (dist > 0.005 && dist < 5) {
      rider.todayDistanceKm = Number((rider.todayDistanceKm + dist).toFixed(2));
    }
  }

  // Record breadcrumb
  if (!rider.history) rider.history = [];
  rider.history.push({
    lat: Number(lat),
    lng: Number(lng),
    speed: rider.speed,
    timestamp: rider.lastPing,
    heading: rider.heading,
    address: rider.location.address,
  });
  if (rider.history.length > 100) rider.history.shift();

  res.json({ success: true, rider });
});

// Update rider status
app.post('/api/riders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, sosReason } = req.body;

  const rider = riders.find((r) => r.id === id);
  if (!rider) {
    return res.status(404).json({ error: 'Rider not found' });
  }

  rider.status = status;
  rider.lastPing = new Date().toISOString();

  if (status === 'emergency') {
    alerts.unshift({
      id: `ALT-SOS-${Date.now()}`,
      riderId: rider.id,
      riderName: rider.name,
      type: 'sos',
      message: `🚨 EMERGENCY SOS: Rider triggered distress! (${sosReason || 'Immediate assistance required'})`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      resolved: false,
      location: { ...rider.location },
    });
  }

  res.json({ success: true, rider });
});

// Remote Nudge
app.post('/api/riders/:id/nudge', (req, res) => {
  const { id } = req.params;
  const rider = riders.find((r) => r.id === id);
  if (!rider) {
    return res.status(404).json({ error: 'Rider not found' });
  }
  rider.nudged = true;
  res.json({ success: true, message: `Remote alert buzzer sent to ${rider.name}` });
});

// Clear nudge
app.post('/api/riders/:id/clear-nudge', (req, res) => {
  const { id } = req.params;
  const rider = riders.find((r) => r.id === id);
  if (rider) rider.nudged = false;
  res.json({ success: true });
});

// Alerts endpoints
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, alerts });
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const alert = alerts.find(a => a.id === id);
  if (alert) alert.resolved = true;
  res.json({ success: true, alert });
});

// Overall Fleet Stats
app.get('/api/stats', (req, res) => {
  const totalRiders = riders.length;
  const onlineRiders = riders.filter(r => r.status !== 'offline').length;
  const movingRiders = riders.filter(r => r.status === 'moving' || (r.status === 'online' && r.speed > 2)).length;
  const idleRiders = riders.filter(r => r.status === 'idle' || (r.status === 'online' && r.speed <= 2)).length;
  const offlineRiders = riders.filter(r => r.status === 'offline').length;
  const activeAlerts = alerts.filter(a => !a.resolved).length;
  const totalDistanceKm = Number(riders.reduce((acc, r) => acc + r.todayDistanceKm, 0).toFixed(1));

  res.json({
    success: true,
    stats: {
      totalRiders,
      onlineRiders,
      movingRiders,
      idleRiders,
      offlineRiders,
      activeAlerts,
      totalDistanceKm,
    }
  });
});

// Reset Fleet to Default Demo
app.post('/api/reset-fleet', (req, res) => {
  riders = JSON.parse(JSON.stringify(INITIAL_RIDERS));
  alerts = JSON.parse(JSON.stringify(INITIAL_ALERTS));
  res.json({ success: true, message: 'Fleet reset successfully' });
});

// ----------------- VITE MIDDLEWARE SETUP -----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RiderTrack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
