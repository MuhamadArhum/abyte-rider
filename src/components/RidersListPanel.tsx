import React, { useState } from 'react';
import { Rider, VehicleType } from '../types';
import { 
  Search, 
  Bike, 
  Car, 
  Truck, 
  Zap, 
  MapPin, 
  Battery, 
  Gauge, 
  Clock, 
  Play, 
  Share2, 
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { formatTimeAgo, formatBattery } from '../utils/geo';

interface RidersListPanelProps {
  riders: Rider[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string) => void;
  onOpenAddRiderModal: () => void;
  onStartRouteReplay: (riderId: string) => void;
  onOpenDirectRiderLink: (riderId: string) => void;
}

export const RidersListPanel: React.FC<RidersListPanelProps> = ({
  riders,
  selectedRiderId,
  onSelectRider,
  onOpenAddRiderModal,
  onStartRouteReplay,
  onOpenDirectRiderLink,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'moving' | 'idle' | 'offline'>('all');

  const filteredRiders = riders.filter((rider) => {
    const matchesSearch =
      rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rider.phone.includes(searchTerm) ||
      rider.vehiclePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rider.location.address && rider.location.address.toLowerCase().includes(searchTerm.toLowerCase()));

    const isMoving = rider.speed > 2 || rider.status === 'moving';
    const isIdle = (rider.speed <= 2 && rider.status !== 'offline') || rider.status === 'idle';
    const isOffline = rider.status === 'offline';

    let matchesStatus = true;
    if (statusFilter === 'moving') matchesStatus = isMoving;
    if (statusFilter === 'idle') matchesStatus = isIdle;
    if (statusFilter === 'offline') matchesStatus = isOffline;

    return matchesSearch && matchesStatus;
  });

  const getVehicleIcon = (type: VehicleType) => {
    switch (type) {
      case 'car':
        return <Car className="w-3.5 h-3.5" />;
      case 'van':
        return <Truck className="w-3.5 h-3.5" />;
      case 'scooter':
        return <Zap className="w-3.5 h-3.5" />;
      default:
        return <Bike className="w-3.5 h-3.5" />;
    }
  };

  const movingCount = riders.filter((r) => r.speed > 2 || r.status === 'moving').length;
  const idleCount = riders.filter((r) => (r.speed <= 2 && r.status !== 'offline') || r.status === 'idle').length;

  return (
    <aside
      aria-label="Active Riders Fleet"
      className="w-full md:w-80 lg:w-96 h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-xs overflow-hidden"
    >
      {/* Header & Search */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">Riders ({riders.length})</h2>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
              {movingCount} Moving
            </span>
          </div>

          <button
            onClick={onOpenAddRiderModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            title="Register rider and send GPS link"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rider, bike plate, area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All ({riders.length})
          </button>
          <button
            onClick={() => setStatusFilter('moving')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              statusFilter === 'moving'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-700 hover:text-emerald-800 border border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Moving ({movingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('idle')}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
              statusFilter === 'idle'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-700 hover:text-amber-800 border border-amber-200'
            }`}
          >
            Stopped ({idleCount})
          </button>
        </div>
      </div>

      {/* Riders Cards List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-slate-50/30">
        {filteredRiders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <p>No matching riders found.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              className="text-emerald-600 underline font-bold"
            >
              Show all riders
            </button>
          </div>
        ) : (
          filteredRiders.map((rider) => {
            const isSelected = rider.id === selectedRiderId;
            const isMoving = rider.speed > 2 || rider.status === 'moving';
            const isEmergency = rider.status === 'emergency';
            const batteryInfo = formatBattery(rider.batteryLevel);

            return (
              <div
                key={rider.id}
                onClick={() => onSelectRider(rider.id)}
                className={`p-3 rounded-xl border transition cursor-pointer relative group ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs'
                }`}
              >
                {/* Top Row: Avatar, Name, Plate & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <img
                        src={rider.avatar}
                        alt={rider.name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
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
                        <h3 className="font-bold text-slate-900 text-xs leading-snug">{rider.name}</h3>
                        <span className="flex items-center text-[10px] text-slate-500">
                          {getVehicleIcon(rider.vehicleType)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">{rider.vehiclePlate}</p>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div>
                    {isEmergency ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> SOS
                      </span>
                    ) : isMoving ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        {rider.speed} km/h
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold font-mono">
                        Stopped {rider.stoppedDurationMinutes ? `${Math.round(rider.stoppedDurationMinutes)}m` : '0m'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Location / Current Street */}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">{rider.location.address || 'Active Street Navigation'}</span>
                </div>

                {/* Telemetry Row */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold">
                      <Gauge className="w-3 h-3 text-slate-400" />
                      {rider.todayDistanceKm} km
                    </span>

                    <span className={`flex items-center gap-1 font-mono font-semibold ${rider.batteryLevel > 20 ? 'text-slate-600' : 'text-rose-600 font-bold'}`}>
                      <Battery className="w-3 h-3" />
                      {rider.batteryLevel}%
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {formatTimeAgo(rider.lastPing)}
                  </span>
                </div>

                {/* Quick Action Buttons */}
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartRouteReplay(rider.id);
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                    title="Replay movement route"
                  >
                    <Play className="w-3 h-3 text-emerald-600" />
                    <span>Replay Path</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDirectRiderLink(rider.id);
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition"
                    title="Share GPS link"
                  >
                    <Share2 className="w-3 h-3 text-blue-600" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
