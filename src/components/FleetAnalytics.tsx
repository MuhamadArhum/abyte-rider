import React from 'react';
import { FleetStats, Rider } from '../types';
import { 
  Users, 
  Radio, 
  Package, 
  Navigation, 
  ShieldAlert, 
  CheckCircle2, 
  Bike, 
  Car, 
  Truck, 
  Zap,
  TrendingUp,
  Activity
} from 'lucide-react';

interface FleetAnalyticsProps {
  stats: FleetStats;
  riders: Rider[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export const FleetAnalytics: React.FC<FleetAnalyticsProps> = ({
  stats,
  riders,
  activeFilter,
  onFilterChange,
}) => {
  const onlinePercent = stats.totalRiders > 0 ? Math.round((stats.onlineRiders / stats.totalRiders) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Riders Online */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Online Fleet</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white font-mono-code">{stats.onlineRiders}</span>
              <span className="text-xs text-slate-500 font-mono">/ {stats.totalRiders}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium">{onlinePercent}% 24/7 Availability</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Active In-Transit Deliveries */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Active Deliveries</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-blue-400 font-mono-code">{stats.activeDeliveries}</span>
              <span className="text-xs text-slate-500 font-mono">live</span>
            </div>
            <span className="text-[10px] text-blue-400 font-medium">On-Time Dispatching</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-950/80 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Total Distance Covered Today */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Distance Covered</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-white font-mono-code">{stats.totalDistanceKm}</span>
              <span className="text-xs text-slate-500 font-mono">km</span>
            </div>
            <span className="text-[10px] text-indigo-400 font-medium">GPS Telemetry Logged</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Navigation className="w-5 h-5" />
          </div>
        </div>

        {/* Security & SOS Alerts */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Security & Alerts</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-2xl font-black font-mono-code ${stats.activeAlerts > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {stats.activeAlerts}
              </span>
              <span className="text-xs text-slate-500 font-mono">issues</span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {stats.activeAlerts > 0 ? 'Action Required' : 'All Clear'}
            </span>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            stats.activeAlerts > 0 
              ? 'bg-rose-950/80 border border-rose-500/40 text-rose-400 animate-pulse' 
              : 'bg-slate-800/80 border border-slate-700 text-slate-400'
          }`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs Bar for Fleet Map */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'all', label: 'All Fleet', count: riders.length },
            { id: 'online', label: 'Online / Available', count: riders.filter((r) => r.status === 'online').length },
            { id: 'delivering', label: 'On Delivery', count: riders.filter((r) => r.status === 'delivering').length },
            { id: 'idle', label: 'Idle / Break', count: riders.filter((r) => r.status === 'idle').length },
            { id: 'offline', label: 'Offline', count: riders.filter((r) => r.status === 'offline').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] bg-slate-950/60 px-1.5 py-0.2 rounded-full font-mono">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
