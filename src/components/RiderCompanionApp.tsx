import React, { useState, useEffect, useRef } from 'react';
import { Rider } from '../types';
import { 
  Power, 
  AlertOctagon, 
  MapPin, 
  Compass, 
  Gauge
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
  }) => void;
  onStatusUpdate: (riderId: string, status: Rider['status'], reason?: string) => void;
  onCreateNewDeviceRider: (name: string, phone: string, vehicleType: Rider['vehicleType']) => Promise<Rider>;
  initialRiderId?: string;
}

export const RiderCompanionApp: React.FC<RiderCompanionAppProps> = ({
  riders,
  onLocationUpdate,
  onStatusUpdate,
  onCreateNewDeviceRider,
  initialRiderId,
}) => {
  const [selectedRiderId, setSelectedRiderId] = useState<string>(initialRiderId || riders[0]?.id || '');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(true);
  const [gpsMode, setGpsMode] = useState<'real' | 'simulated'>('real');
  const [speedSlider, setSpeedSlider] = useState<number>(34);
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState<number>(0);
  const [sosTriggered, setSosTriggered] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);

  const activeRider = riders.find((r) => r.id === selectedRiderId) || riders[0];
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // If initialRiderId changes from URL prop
  useEffect(() => {
    if (initialRiderId && riders.some(r => r.id === initialRiderId)) {
      setSelectedRiderId(initialRiderId);
      setGpsMode('real');
      setIsTransmitting(true);
    }
  }, [initialRiderId, riders]);

  // Request WakeLock to keep screen awake while riding
  useEffect(() => {
    let wakeLockSentinel: any = null;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isTransmitting) {
        try {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockActive(true);
        } catch (err) {
          console.warn('Wake Lock request failed:', err);
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

  // Shift timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTransmitting) {
      timer = setInterval(() => {
        setShiftDurationSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isTransmitting]);

  // Handle Remote Nudge / Alert Buzzer from Admin
  useEffect(() => {
    if (activeRider?.nudged) {
      if (soundEnabled) {
        soundManager.playNudgeBuzzer();
      }
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
  }, [activeRider?.nudged, soundEnabled]);

  // Real GPS Geolocation Watcher
  useEffect(() => {
    if (!isTransmitting || gpsMode !== 'real' || !activeRider) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not available in browser');
      setGpsMode('simulated');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        const heading = pos.coords.heading || 0;
        const accuracy = Math.round(pos.coords.accuracy) || 5;

        onLocationUpdate(activeRider.id, {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          speed: speedKmh,
          heading: heading,
          accuracy: accuracy,
          batteryLevel: activeRider.batteryLevel || 85,
        });
      },
      (err) => {
        console.warn('GPS watch error:', err);
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
      }
    };
  }, [isTransmitting, gpsMode, activeRider?.id]);

  // Simulated GPS movement loop for testing
  useEffect(() => {
    if (!isTransmitting || gpsMode !== 'simulated' || !activeRider) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      return;
    }

    simIntervalRef.current = setInterval(() => {
      const heading = (activeRider.heading + (Math.random() - 0.5) * 20 + 360) % 360;
      const rad = (heading * Math.PI) / 180;
      const step = 0.00035 * (speedSlider / 35);

      const nextLat = Number((activeRider.location.lat + Math.cos(rad) * step).toFixed(6));
      const nextLng = Number((activeRider.location.lng + Math.sin(rad) * step).toFixed(6));

      onLocationUpdate(activeRider.id, {
        lat: nextLat,
        lng: nextLng,
        speed: speedSlider,
        heading: heading,
        accuracy: 3,
        batteryLevel: Math.max(10, activeRider.batteryLevel - (Math.random() < 0.02 ? 1 : 0)),
      });
    }, 2500);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isTransmitting, gpsMode, speedSlider, activeRider?.id, activeRider?.heading]);

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

  if (!activeRider) return null;

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl flex flex-col my-auto select-none text-slate-900">
      {/* Mobile Device Status Bar */}
      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-extrabold text-slate-900">24/7 GPS TRANSMITTER</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
          <span>{formatSeconds(shiftDurationSeconds)}</span>
          <span className="text-slate-800 font-bold">{activeRider.batteryLevel}%</span>
        </div>
      </div>

      {/* Driver Profile Switcher */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={activeRider.avatar}
            alt={activeRider.name}
            className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
          />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 leading-tight">{activeRider.name}</h2>
            <p className="text-xs text-slate-500 font-mono">{activeRider.vehiclePlate}</p>
          </div>
        </div>

        {/* Change Active Rider Selector */}
        <select
          value={selectedRiderId}
          onChange={(e) => setSelectedRiderId(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 font-medium"
        >
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.vehicleType.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      {/* Main GPS Transmitter Cockpit */}
      <div className="p-5 space-y-4">
        {/* Transmission Status Card */}
        <div
          className={`p-4 rounded-2xl border text-center transition-all ${
            isTransmitting
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
              {isTransmitting ? 'LIVE GPS BROADCASTING ACTIVE' : 'TRANSMITTER PAUSED / OFF'}
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            {isTransmitting
              ? 'Admin map is tracking your live coordinates in real-time.'
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
            <span>{isTransmitting ? 'Stop Live Transmission' : 'START 24/7 GPS TRANSMITTER'}</span>
          </button>
        </div>

        {/* Digital Speedometer Gauge */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="text-5xl font-black font-mono text-slate-900 tracking-tighter flex items-baseline gap-1">
            <span>{isTransmitting ? (gpsMode === 'real' ? activeRider.speed : speedSlider) : 0}</span>
            <span className="text-sm font-bold text-emerald-700">KM/H</span>
          </div>

          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span>Heading {activeRider.heading}° • Precision ±{activeRider.accuracy}m</span>
          </div>

          {wakeLockActive && (
            <span className="mt-2 text-[10px] bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-0.5 rounded-full font-mono font-semibold">
              📱 Screen Keep-Awake Active
            </span>
          )}
        </div>

        {/* Real GPS vs Virtual Simulation Switcher */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">GPS Source:</span>
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-300">
              <button
                onClick={() => setGpsMode('real')}
                className={`px-3 py-1 rounded-md font-bold transition text-xs ${
                  gpsMode === 'real' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                Real GPS
              </button>
              <button
                onClick={() => setGpsMode('simulated')}
                className={`px-3 py-1 rounded-md font-bold transition text-xs ${
                  gpsMode === 'simulated' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
                }`}
              >
                Virtual Test
              </button>
            </div>
          </div>

          {gpsMode === 'simulated' && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Test Cruise Speed</span>
                <span className="font-mono text-emerald-700 font-bold">{speedSlider} km/h</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                value={speedSlider}
                onChange={(e) => setSpeedSlider(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />
            </div>
          )}
        </div>

        {/* Current Location Coordinates */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-800 truncate">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">{activeRider.location.address || 'Active Street Pin'}</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500 shrink-0">
            {activeRider.location.lat.toFixed(4)}, {activeRider.location.lng.toFixed(4)}
          </span>
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
      </div>
    </div>
  );
};
