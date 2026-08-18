import React, { useState, useEffect, useRef } from 'react';
import { Rider } from '../types';
import { 
  Power, 
  AlertOctagon, 
  MapPin, 
  Compass, 
  Gauge,
  Radio,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Battery,
  ShieldCheck,
  UserPlus,
  ArrowLeft,
  Share2,
  RefreshCw
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface RiderCompanionAppProps {
  riders: Rider[];
  onLocationUpdate: (riderId: string, locationData: {
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    batteryLevel: number;
    address?: string;
  }) => void;
  onStatusUpdate: (riderId: string, status: Rider['status'], reason?: string) => void;
  onCreateNewDeviceRider: (name: string, phone: string, vehicleType: Rider['vehicleType']) => Promise<Rider | null>;
  initialRiderId?: string;
  onSwitchToAdmin?: () => void;
}

export const RiderCompanionApp: React.FC<RiderCompanionAppProps> = ({
  riders,
  onLocationUpdate,
  onStatusUpdate,
  onCreateNewDeviceRider,
  initialRiderId,
  onSwitchToAdmin,
}) => {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const urlRiderParam = urlParams.get('rider') || initialRiderId || '';
  const urlNameParam = urlParams.get('name') || '';
  const urlPlateParam = urlParams.get('plate') || '';

  const [selectedRiderId, setSelectedRiderId] = useState<string>(urlRiderParam || (riders[0]?.id) || 'RDR-001');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(true);
  const [gpsPermissionState, setGpsPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [currentGpsCoords, setCurrentGpsCoords] = useState<{ lat: number; lng: number; speed: number; heading: number; accuracy: number } | null>(null);
  const [deviceBattery, setDeviceBattery] = useState<number>(85);
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState<number>(0);
  const [sosTriggered, setSosTriggered] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [lastPingTime, setLastPingTime] = useState<string>('');
  const [gpsWatchError, setGpsWatchError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // Sync rider ID
  useEffect(() => {
    if (urlRiderParam) {
      setSelectedRiderId(urlRiderParam);
    } else if (riders.length > 0 && !selectedRiderId) {
      setSelectedRiderId(riders[0].id);
    }
  }, [urlRiderParam, riders, selectedRiderId]);

  // Read real device battery level if API is available
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setDeviceBattery(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setDeviceBattery(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Request WakeLock to keep phone screen awake during delivery shift
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isTransmitting) {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        } catch (err) {
          console.warn('Wake Lock error:', err);
        }
      }
    };

    if (isTransmitting) {
      requestWakeLock();
    } else if (wakeLockSentinel) {
      wakeLockSentinel.release();
      setWakeLockActive(false);
    }

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release();
      }
    };
  }, [isTransmitting]);

  // Shift Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTransmitting) {
      timer = setInterval(() => {
        setShiftDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTransmitting]);

  // Handle Admin Remote Nudge / Alert Buzzer
  const foundRider = riders.find((r) => r.id === selectedRiderId);
  useEffect(() => {
    if (foundRider?.nudged) {
      if (soundEnabled) {
        soundManager.playNudgeBuzzer();
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
  }, [foundRider?.nudged, soundEnabled]);

  // Construct guaranteed active rider object (Never crashes or blanks on mobile)
  const activeRider: Rider = foundRider || {
    id: selectedRiderId || urlRiderParam || 'RDR-001',
    name: urlNameParam || (selectedRiderId ? `Rider ${selectedRiderId}` : 'Active Rider'),
    phone: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    vehicleType: 'bike',
    vehiclePlate: urlPlateParam || 'GPS-LIVE',
    status: 'online',
    location: {
      lat: 24.8607,
      lng: 67.0011,
      address: 'Live Location Pin',
    },
    heading: 0,
    speed: 0,
    batteryLevel: deviceBattery,
    accuracy: 3,
    lastPing: new Date().toISOString(),
    todayDistanceKm: 0,
    maxSpeedToday: 0,
    stoppedDurationMinutes: 0,
    rating: 5.0,
    city: 'Karachi',
    isSimulated: false,
    history: [],
  };

  // Pure Real Hardware GPS Geolocation Watcher
  useEffect(() => {
    if (!isTransmitting) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsPermissionState('denied');
      setGpsWatchError('Your mobile browser does not support GPS Geolocation.');
      return;
    }

    // High accuracy real GPS tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsPermissionState('granted');
        setGpsWatchError(null);
        const speedKmh = pos.coords.speed !== null && pos.coords.speed >= 0 
          ? Math.round(pos.coords.speed * 3.6) 
          : (currentGpsCoords ? currentGpsCoords.speed : 0);
        
        const heading = pos.coords.heading !== null && pos.coords.heading >= 0 
          ? Math.round(pos.coords.heading) 
          : 0;

        const accuracy = Math.round(pos.coords.accuracy) || 3;
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        setCurrentGpsCoords({
          lat,
          lng,
          speed: speedKmh,
          heading,
          accuracy,
        });

        const timeStr = new Date().toLocaleTimeString();
        setLastPingTime(timeStr);

        onLocationUpdate(activeRider.id, {
          lat,
          lng,
          speed: speedKmh,
          heading,
          accuracy,
          batteryLevel: deviceBattery,
        });
      },
      (err) => {
        console.warn('Real GPS Error:', err);
        if (err.code === 1) {
          setGpsPermissionState('denied');
          setGpsWatchError('Location permission denied. Please allow location in browser.');
        } else {
          setGpsWatchError(err.message || 'Searching for GPS satellite signal...');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTransmitting, activeRider.id, deviceBattery]);

  const handleToggleTransmitter = () => {
    const nextState = !isTransmitting;
    setIsTransmitting(nextState);
    if (activeRider) {
      onStatusUpdate(activeRider.id, nextState ? 'moving' : 'offline');
    }
  };

  const handleTriggerSos = () => {
    soundManager.playEmergencySiren();
    setSosTriggered(true);
    if (activeRider) {
      onStatusUpdate(activeRider.id, 'emergency', 'Assistance Triggered from Phone');
    }
  };

  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl flex flex-col my-auto select-none text-slate-900">
      {/* Mobile Device Status Bar */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span className="font-extrabold text-slate-900 tracking-wide">REAL 24/7 GPS TRANSMITTER</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
          <span>{formatSeconds(shiftDurationSeconds)}</span>
          <span className="text-slate-800 font-bold flex items-center gap-1">
            <Battery className="w-3.5 h-3.5 text-emerald-600" />
            {deviceBattery}%
          </span>
        </div>
      </div>

      {/* Driver Profile Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
            {activeRider.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 leading-tight">{activeRider.name}</h2>
            <p className="text-xs text-slate-500 font-mono">
              ID: {activeRider.id} • {activeRider.vehiclePlate || 'GPS Active'}
            </p>
          </div>
        </div>

        {/* Change Active Rider Selector if multiple */}
        {riders.length > 1 && (
          <select
            value={selectedRiderId}
            onChange={(e) => setSelectedRiderId(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
          >
            {riders.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Main GPS Transmitter Cockpit */}
      <div className="p-5 space-y-4">
        {/* GPS Permission Warning if Denied */}
        {gpsPermissionState === 'denied' && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Location Permission Required</span>
            </div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              Mobile browser me <b>"Allow Location / GPS"</b> ko enable karein taake aapki real movement admin dashboard pe dikh sake.
            </p>
          </div>
        )}

        {/* Transmission Status Card */}
        <div
          className={`p-4 rounded-2xl border text-center transition-all ${
            isTransmitting && gpsPermissionState === 'granted'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span
              className={`w-3 h-3 rounded-full ${
                isTransmitting ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
              }`}
            />
            <h3 className="text-sm font-black tracking-wide text-slate-900">
              {isTransmitting ? 'LIVE GPS BROADCASTING ACTIVE' : 'TRANSMITTER PAUSED'}
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            {isTransmitting
              ? 'Phone hardware GPS is broadcasting real coordinates directly to Firestore.'
              : 'Tap button below to start sending location.'}
          </p>

          {/* Toggle Transmitter Button */}
          <button
            onClick={handleToggleTransmitter}
            className={`mt-3 w-full py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-xs ${
              isTransmitting
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isTransmitting ? 'Pause Location Transmission' : 'START REAL GPS BROADCAST'}</span>
          </button>
        </div>

        {/* Digital Speedometer Gauge */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="text-5xl font-black font-mono text-slate-900 tracking-tighter flex items-baseline gap-1">
            <span>{isTransmitting && currentGpsCoords ? currentGpsCoords.speed : 0}</span>
            <span className="text-sm font-bold text-emerald-700">KM/H</span>
          </div>

          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Heading {currentGpsCoords?.heading || 0}° • GPS Precision ±{currentGpsCoords?.accuracy || activeRider.accuracy}m
            </span>
          </div>

          {wakeLockActive && (
            <span className="mt-2 text-[10px] bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              📱 Screen Keep-Awake Active
            </span>
          )}
        </div>

        {/* Real GPS Live Coordinates Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Live Hardware Coordinates
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {lastPingTime ? `Ping: ${lastPingTime}` : 'Acquiring Satellites...'}
            </span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between font-mono text-xs text-slate-700">
            <span>
              {currentGpsCoords
                ? `${currentGpsCoords.lat.toFixed(6)}, ${currentGpsCoords.lng.toFixed(6)}`
                : `${activeRider.location.lat.toFixed(6)}, ${activeRider.location.lng.toFixed(6)}`}
            </span>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
              Live Hardware
            </span>
          </div>
        </div>

        {/* Emergency SOS Button */}
        <div>
          {sosTriggered ? (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-center text-rose-800 text-xs font-bold">
              🚨 SOS SIGNAL SENT TO ADMIN MAP
            </div>
          ) : (
            <button
              onClick={handleTriggerSos}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition"
            >
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>EMERGENCY SOS DISTRESS SIGNAL</span>
            </button>
          )}
        </div>

        {/* Switch to Admin Map Link */}
        {onSwitchToAdmin && (
          <div className="text-center pt-1">
            <button
              onClick={onSwitchToAdmin}
              className="text-xs text-slate-500 hover:text-emerald-700 underline font-medium"
            >
              ← Open Admin Fleet Map
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
