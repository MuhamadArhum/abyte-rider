import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Rider, FleetAlert, BreadcrumbPoint } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Subscribe to Live Fleet in Real-Time via Firestore onSnapshot
export function subscribeToFleetRiders(callback: (riders: Rider[]) => void) {
  const ridersCol = collection(db, 'riders');
  return onSnapshot(
    ridersCol,
    (snapshot) => {
      const ridersList: Rider[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        ridersList.push({
          id: docSnap.id,
          name: data.name || 'Rider',
          phone: data.phone || '',
          avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          vehicleType: data.vehicleType || 'bike',
          vehiclePlate: data.vehiclePlate || 'KHI-0000',
          status: data.status || 'online',
          location: {
            lat: Number(data.lat) || 24.8607,
            lng: Number(data.lng) || 67.0011,
            address: data.address || 'Active Street Pin',
          },
          heading: Number(data.heading) || 0,
          speed: Number(data.speed) || 0,
          batteryLevel: Number(data.batteryLevel) ?? 100,
          accuracy: Number(data.accuracy) || 3,
          lastPing: data.lastPing || new Date().toISOString(),
          todayDistanceKm: Number(data.todayDistanceKm) || 0,
          maxSpeedToday: Number(data.maxSpeedToday) || 0,
          stoppedDurationMinutes: Number(data.stoppedDurationMinutes) || 0,
          rating: Number(data.rating) || 5.0,
          city: data.city || 'Karachi',
          isSimulated: Boolean(data.isSimulated),
          nudged: Boolean(data.nudged),
          history: data.recentHistory || [],
        });
      });
      callback(ridersList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'riders');
    }
  );
}

// Subscribe to Alerts in Real-Time
export function subscribeToFleetAlerts(callback: (alerts: FleetAlert[]) => void) {
  const alertsCol = collection(db, 'alerts');
  return onSnapshot(
    alertsCol,
    (snapshot) => {
      const alertsList: FleetAlert[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        alertsList.push({
          id: docSnap.id,
          riderId: data.riderId,
          riderName: data.riderName,
          type: data.type,
          message: data.message,
          timestamp: data.timestamp,
          severity: data.severity || 'warning',
          resolved: Boolean(data.resolved),
          location: {
            lat: data.lat || 24.8607,
            lng: data.lng || 67.0011,
          },
        });
      });
      callback(alertsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'alerts');
    }
  );
}

// Save Live Location Ping to Firestore (Updates Rider Document + Adds Permanent GpsLog)
export async function saveLiveGpsPingToFirestore(
  riderId: string,
  locationData: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    batteryLevel: number;
    address?: string;
  }
) {
  const path = `riders/${riderId}`;
  try {
    const riderRef = doc(db, 'riders', riderId);
    const riderSnap = await getDoc(riderRef);

    const nowIso = new Date().toISOString();
    const todayDateStr = nowIso.split('T')[0]; // "2026-08-18"
    const isMoving = locationData.speed > 2;

    const prevData = riderSnap.exists() ? riderSnap.data() : null;
    let todayDistanceKm = prevData?.todayDistanceKm || 0;
    let maxSpeedToday = Math.max(prevData?.maxSpeedToday || 0, locationData.speed);

    // Calculate distance delta
    if (prevData?.lat && prevData?.lng) {
      const dist = calculateDistanceKm(prevData.lat, prevData.lng, locationData.lat, locationData.lng);
      if (dist > 0.005 && dist < 5) {
        todayDistanceKm = Number((todayDistanceKm + dist).toFixed(2));
      }
    }

    const currentBreadcrumb: BreadcrumbPoint = {
      lat: locationData.lat,
      lng: locationData.lng,
      speed: locationData.speed,
      timestamp: nowIso,
      heading: locationData.heading,
      address: locationData.address || 'Street Coordinates',
    };

    const recentHistory = (prevData?.recentHistory || []).slice(-99);
    recentHistory.push(currentBreadcrumb);

    // 1. Update /riders/{riderId} document with live state
    await setDoc(
      riderRef,
      {
        id: riderId,
        name: prevData?.name || `Rider ${riderId}`,
        phone: prevData?.phone || '',
        vehicleType: prevData?.vehicleType || 'bike',
        vehiclePlate: prevData?.vehiclePlate || 'GPS-LIVE',
        city: prevData?.city || 'Karachi',
        lat: locationData.lat,
        lng: locationData.lng,
        address: locationData.address || prevData?.address || 'Street Pin',
        speed: locationData.speed,
        heading: locationData.heading,
        accuracy: locationData.accuracy,
        batteryLevel: locationData.batteryLevel,
        status: isMoving ? 'moving' : 'idle',
        stoppedDurationMinutes: isMoving ? 0 : ((prevData?.stoppedDurationMinutes || 0) + 0.1),
        lastPing: nowIso,
        todayDistanceKm,
        maxSpeedToday,
        recentHistory,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 2. Permanently record this GPS log into /riders/{riderId}/gps_logs/{logId} subcollection
    const logId = `log_${Date.now()}`;
    const logRef = doc(db, 'riders', riderId, 'gps_logs', logId);
    await setDoc(logRef, {
      riderId,
      lat: locationData.lat,
      lng: locationData.lng,
      speed: locationData.speed,
      heading: locationData.heading,
      accuracy: locationData.accuracy,
      batteryLevel: locationData.batteryLevel,
      timestamp: nowIso,
      date: todayDateStr,
      address: locationData.address || 'Street Pin',
    });

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch Historical Route for a specific Rider & Date from Firestore
export async function getRiderHistoryLogsFromFirestore(
  riderId: string,
  dateString?: string
): Promise<BreadcrumbPoint[]> {
  const path = `riders/${riderId}/gps_logs`;
  try {
    const logsCol = collection(db, 'riders', riderId, 'gps_logs');
    let q = query(logsCol, orderBy('timestamp', 'asc'), limit(500));

    if (dateString) {
      q = query(logsCol, where('date', '==', dateString), orderBy('timestamp', 'asc'), limit(500));
    }

    const snapshot = await getDocs(q);
    const points: BreadcrumbPoint[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      points.push({
        lat: data.lat,
        lng: data.lng,
        speed: data.speed || 0,
        timestamp: data.timestamp,
        heading: data.heading || 0,
        address: data.address,
      });
    });
    return points;
  } catch (error) {
    console.warn('Could not fetch historical subcollection logs, falling back to recent history:', error);
    return [];
  }
}

// Add a New Rider to Firestore
export async function addRiderToFirestore(riderData: {
  name: string;
  phone: string;
  vehicleType: Rider['vehicleType'];
  vehiclePlate: string;
  city: string;
  lat?: number;
  lng?: number;
}): Promise<Rider> {
  const newId = `RDR-${Math.floor(1000 + Math.random() * 9000)}`;
  const path = `riders/${newId}`;
  const nowIso = new Date().toISOString();

  const newRider: Rider = {
    id: newId,
    name: riderData.name,
    phone: riderData.phone,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    vehicleType: riderData.vehicleType,
    vehiclePlate: riderData.vehiclePlate,
    status: 'online',
    location: {
      lat: riderData.lat || 24.8607,
      lng: riderData.lng || 67.0011,
      address: `${riderData.city} Base Station`,
    },
    heading: 0,
    speed: 0,
    batteryLevel: 100,
    accuracy: 3,
    lastPing: nowIso,
    todayDistanceKm: 0,
    maxSpeedToday: 0,
    stoppedDurationMinutes: 0,
    rating: 5.0,
    city: riderData.city,
    isSimulated: false,
    history: [],
  };

  try {
    const riderRef = doc(db, 'riders', newId);
    await setDoc(riderRef, {
      id: newId,
      name: newRider.name,
      phone: newRider.phone,
      avatar: newRider.avatar,
      vehicleType: newRider.vehicleType,
      vehiclePlate: newRider.vehiclePlate,
      status: newRider.status,
      lat: newRider.location.lat,
      lng: newRider.location.lng,
      address: newRider.location.address,
      heading: 0,
      speed: 0,
      batteryLevel: 100,
      accuracy: 3,
      lastPing: nowIso,
      todayDistanceKm: 0,
      maxSpeedToday: 0,
      stoppedDurationMinutes: 0,
      rating: 5.0,
      city: newRider.city,
      isSimulated: false,
      recentHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return newRider;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return newRider;
  }
}

// Delete Rider from Firestore
export async function deleteRiderFromFirestore(riderId: string) {
  const path = `riders/${riderId}`;
  try {
    const riderRef = doc(db, 'riders', riderId);
    await deleteDoc(riderRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Clear all riders from Firestore
export async function clearAllRidersFromFirestore() {
  const path = 'riders';
  try {
    const snapshot = await getDocs(collection(db, 'riders'));
    const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(doc(db, 'riders', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Seed Initial Pakistani Demo Fleet into Firestore if totally empty
export async function seedInitialFleetIfEmpty() {
  try {
    const ridersCol = collection(db, 'riders');
    const snapshot = await getDocs(query(ridersCol, limit(1)));
    if (!snapshot.empty) return; // Already has data

    const sampleRiders: any[] = [
      {
        id: 'RDR-001',
        name: 'Muhammad Tariq',
        phone: '+92 301 2345678',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        vehicleType: 'bike',
        vehiclePlate: 'KHI-7890 (Honda 125)',
        status: 'moving',
        lat: 24.8607,
        lng: 67.0011,
        address: 'Saddar Market Zone B',
        heading: 45,
        speed: 38,
        batteryLevel: 86,
        accuracy: 3,
        lastPing: new Date().toISOString(),
        todayDistanceKm: 42.8,
        maxSpeedToday: 58,
        stoppedDurationMinutes: 0,
        rating: 4.9,
        city: 'Karachi',
        isSimulated: true,
        recentHistory: [
          { lat: 24.8480, lng: 66.9910, speed: 28, timestamp: new Date(Date.now() - 35 * 60000).toISOString(), heading: 25, address: 'Tower' },
          { lat: 24.8520, lng: 66.9950, speed: 32, timestamp: new Date(Date.now() - 25 * 60000).toISOString(), heading: 30, address: 'I.I Chundrigar' },
          { lat: 24.8560, lng: 66.9980, speed: 36, timestamp: new Date(Date.now() - 15 * 60000).toISOString(), heading: 40, address: 'MA Jinnah' },
          { lat: 24.8607, lng: 67.0011, speed: 38, timestamp: new Date().toISOString(), heading: 45, address: 'Saddar Market' },
        ],
      },
      {
        id: 'RDR-002',
        name: 'Ali Raza Khan',
        phone: '+92 312 9876543',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        vehicleType: 'bike',
        vehiclePlate: 'KHI-4321 (Yamaha YBR)',
        status: 'moving',
        lat: 24.8715,
        lng: 67.0599,
        address: 'PECHS Block 2 Main Blvd',
        heading: 120,
        speed: 26,
        batteryLevel: 68,
        accuracy: 4,
        lastPing: new Date().toISOString(),
        todayDistanceKm: 55.4,
        maxSpeedToday: 62,
        stoppedDurationMinutes: 0,
        rating: 4.8,
        city: 'Karachi',
        isSimulated: true,
        recentHistory: [
          { lat: 24.8620, lng: 67.0420, speed: 30, timestamp: new Date(Date.now() - 20 * 60000).toISOString(), heading: 105, address: 'Shahrah-e-Faisal' },
          { lat: 24.8715, lng: 67.0599, speed: 26, timestamp: new Date().toISOString(), heading: 120, address: 'PECHS Block 2' },
        ],
      },
      {
        id: 'RDR-003',
        name: 'Kamran Haider',
        phone: '+92 333 4455667',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        vehicleType: 'car',
        vehiclePlate: 'KHI-9988 (Suzuki Alto)',
        status: 'moving',
        lat: 24.8138,
        lng: 67.0496,
        address: 'Clifton Block 4 Sea View Rd',
        heading: 210,
        speed: 46,
        batteryLevel: 42,
        accuracy: 3,
        lastPing: new Date().toISOString(),
        todayDistanceKm: 68.2,
        maxSpeedToday: 74,
        stoppedDurationMinutes: 0,
        rating: 4.7,
        city: 'Karachi',
        isSimulated: true,
        recentHistory: [
          { lat: 24.8350, lng: 67.0250, speed: 50, timestamp: new Date(Date.now() - 18 * 60000).toISOString(), heading: 195, address: 'Boat Basin' },
          { lat: 24.8138, lng: 67.0496, speed: 46, timestamp: new Date().toISOString(), heading: 210, address: 'Clifton Sea View' },
        ],
      },
    ];

    for (const r of sampleRiders) {
      await setDoc(doc(db, 'riders', r.id), r);
    }
  } catch (err) {
    console.warn('Initial fleet seed error:', err);
  }
}

// Distance helper
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
