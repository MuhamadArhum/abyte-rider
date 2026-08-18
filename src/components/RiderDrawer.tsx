import React, { useState, useEffect } from 'react';
import { Rider, BreadcrumbPoint } from '../types';
import { 
  X, 
  Phone, 
  Navigation, 
  Battery, 
  Gauge, 
  MapPin, 
  Clock, 
  Play, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  BellRing, 
  AlertTriangle, 
  Bike, 
  Car, 
  Truck, 
  Zap, 
  Compass,
  TrendingUp,
  Trash2,
  Smartphone,
  Calendar,
  Database,
  History,
  ListFilter
} from 'lucide-react';
import { formatTimeAgo, formatBattery, getHeadingDirection } from '../utils/geo';
import { soundManager } from '../utils/audio';
import { getRiderHistoryLogsFromFirestore } from '../services/firebaseFleetService';
import { getShareableRiderUrl } from '../utils/urlHelper';

interface RiderDrawerProps {
  rider: Rider | null;
  onClose: () => void;
  onNudgeRider: (riderId: string) => void;
  onStartRouteReplay: (riderId: string) => void;
  onOpenShareModal: (rider: Rider) => void;
  onDeleteRider?: (riderId: string) => Promise<void>;
}

export const RiderDrawer: React.FC<RiderDrawerProps> = ({
  rider,
  onClose,
  onNudgeRider,
  onStartRouteReplay,
  onOpenShareModal,
  onDeleteRider,
}) => {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [historyLogs, setHistoryLogs] = useState<BreadcrumbPoint[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);

  // Load permanent Firestore history logs when switching to history tab or changing date
  useEffect(() => {
    if (!rider || activeTab !== 'history') return;

    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      const logs = await getRiderHistoryLogsFromFirestore(rider.id, selectedDate);
      if (logs.length > 0) {
        setHistoryLogs(logs);
      } else {
        // Fallback to rider's current recent breadcrumb points
        setHistoryLogs(rider.history || []);
      }
      setIsLoadingLogs(false);
    };

    fetchLogs();
  }, [rider?.id, activeTab, selectedDate]);

  if (!rider) return null;

  const isMoving = rider.speed > 2 || rider.status === 'moving';
  const isEmergency = rider.status === 'emergency';

  const handleCopyCoordinates = () => {
    const text = `${rider.location.lat.toFixed(6)}, ${rider.location.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyTransmitterLink = () => {
    const url = getShareableRiderUrl(rider.id);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendNudge = () => {
    soundManager.playNudgeBuzzer();
    onNudgeRider(rider.id);
    setNudgeSent(true);
    setTimeout(() => setNudgeSent(false), 2500);
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  };

  const formatTimestampTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <aside
      aria-label="Rider Details"
      className="w-full md:w-96 lg:w-[410px] h-full bg-white border-l border-slate-200 flex flex-col z-30 shadow-md overflow-hidden text-slate-900"
    >
      {/* Header Profile Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={rider.avatar}
                alt={rider.name}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs"
              />
              <span
                className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                  isEmergency
                    ? 'bg-rose-500 animate-ping'
                    : isMoving
                    ? 'bg-emerald-500'
                    : rider.status === 'idle'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-slate-900 text-base leading-snug">{rider.name}</h3>
                <span className="p-1 rounded-md bg-slate-200/80 text-slate-700 text-xs font-bold">
                  {rider.vehicleType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {rider.vehiclePlate} • {rider.city}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onDeleteRider && (
              <button
                onClick={async () => {
                  if (confirm(`Remove rider ${rider.name} from fleet?`)) {
                    await onDeleteRider(rider.id);
                  }
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Delete Rider"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Live Telemetry vs Permanent Database History */}
        <div className="flex mt-3 bg-slate-200/70 p-1 rounded-xl gap-1 text-xs">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'live'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Live Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'history'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Database History Logs</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
        {activeTab === 'live' ? (
          /* TAB 1: LIVE TELEMETRY */
          <>
            {/* Live Status Banner */}
            <div>
              {isEmergency ? (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-rose-800">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                    <span>EMERGENCY SOS ACTIVE</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold">Alert</span>
                </div>
              ) : isMoving ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-900">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>MOVING ({rider.speed} km/h)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">
                    {getHeadingDirection(rider.heading)} ({rider.heading}°)
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>STOPPED / IDLE</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-700 font-bold">
                    {rider.stoppedDurationMinutes ? `${Math.round(rider.stoppedDurationMinutes)} mins` : 'Just stopped'}
                  </span>
                </div>
              )}
            </div>

            {/* Direct WhatsApp / Phone Transmitter Link */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" /> 24/7 Mobile GPS Link
                </span>
                <button
                  onClick={handleCopyTransmitterLink}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedLink ? 'Link Copied' : 'Copy'}</span>
                </button>
              </div>
              <button
                onClick={() => onOpenShareModal(rider)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Send Tracking Link via WhatsApp</span>
              </button>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span className="flex items-center gap-1 font-medium"><Gauge className="w-3.5 h-3.5 text-emerald-600" /> Speed</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 font-mono flex items-baseline gap-1">
                  <span>{rider.speed}</span>
                  <span className="text-xs font-normal text-slate-500">km/h</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Max: {rider.maxSpeedToday || rider.speed} km/h
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span className="flex items-center gap-1 font-medium"><TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Today</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 font-mono flex items-baseline gap-1">
                  <span>{rider.todayDistanceKm}</span>
                  <span className="text-xs font-normal text-slate-500">km</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Saved Pings: {rider.history?.length || 0}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span className="flex items-center gap-1 font-medium"><Battery className="w-3.5 h-3.5 text-amber-600" /> Battery</span>
                </div>
                <div className="text-xl font-extrabold font-mono text-slate-900 flex items-baseline gap-1">
                  <span>{rider.batteryLevel}</span>
                  <span className="text-xs font-normal text-slate-500">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {rider.batteryLevel > 20 ? 'Battery Good' : '⚠️ Low Battery'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
                  <span className="flex items-center gap-1 font-medium"><Compass className="w-3.5 h-3.5 text-purple-600" /> Accuracy</span>
                </div>
                <div className="text-xl font-extrabold text-slate-900 font-mono flex items-baseline gap-1">
                  <span>±{rider.accuracy}</span>
                  <span className="text-xs font-normal text-slate-500">m</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatTimeAgo(rider.lastPing)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => onStartRouteReplay(rider.id)}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs"
              >
                <Play className="w-4 h-4" />
                <span>Replay Movement Route (Animated)</span>
              </button>

              <button
                onClick={handleSendNudge}
                disabled={nudgeSent}
                className={`w-full py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  nudgeSent
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>{nudgeSent ? 'Alert Chime Sent to Rider Phone!' : 'Send Remote Alert Buzzer'}</span>
              </button>
            </div>

            {/* Coordinates */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Exact Live Pin
                </span>
                <button
                  onClick={() => openInGoogleMaps(rider.location.lat, rider.location.lng)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600">
                <span>{rider.location.lat.toFixed(6)}, {rider.location.lng.toFixed(6)}</span>
                <button
                  onClick={handleCopyCoordinates}
                  className="text-emerald-700 hover:text-emerald-900 font-bold transition flex items-center gap-1"
                >
                  {copiedCoords ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCoords ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* TAB 2: DATABASE HISTORY LOGS (EVERY DATA VIEW) */
          <div className="space-y-3.5">
            {/* Date Filter */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Select History Date:</span>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Stats Summary for this Day */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-950">
              <div>
                <span className="text-[10px] text-blue-700 uppercase font-bold block">Recorded Pings</span>
                <span className="font-extrabold text-base font-mono">{historyLogs.length} Points</span>
              </div>
              <button
                onClick={() => onStartRouteReplay(rider.id)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-2xs transition"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Replay on Map</span>
              </button>
            </div>

            {/* Chronological Table of Every GPS Ping */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                Detailed GPS Breadcrumbs Log ({historyLogs.length})
              </h4>

              {isLoadingLogs ? (
                <div className="p-6 text-center text-xs text-slate-500">Loading Firestore logs...</div>
              ) : historyLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                  No GPS logs recorded for this date yet.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {historyLogs.map((log, index) => (
                    <div
                      key={index}
                      className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-2 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold font-mono text-slate-900 text-[11px]">
                            {formatTimestampTime(log.timestamp)}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] font-mono">
                            {log.speed} km/h
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {log.lat.toFixed(5)}, {log.lng.toFixed(5)} ({getHeadingDirection(log.heading)})
                        </p>
                      </div>

                      <button
                        onClick={() => openInGoogleMaps(log.lat, log.lng)}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="View Pin on Google Maps"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
