import React from 'react';
import { 
  Radio, 
  Map, 
  Smartphone, 
  UserPlus, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  CheckCircle2
} from 'lucide-react';

interface NavbarProps {
  currentView: 'admin' | 'rider';
  onViewChange: (view: 'admin' | 'rider') => void;
  onOpenAddRiderModal: () => void;
  onResetFleet: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeEmergencyCount: number;
  activeMovingCount: number;
  totalRiders: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  onOpenAddRiderModal,
  onResetFleet,
  soundEnabled,
  onToggleSound,
  activeEmergencyCount,
  activeMovingCount,
  totalRiders,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2.5 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
          <Radio className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">RiderTrack 24/7</h1>
            <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              LIVE GPS
            </span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Real-Time Rider Fleet Location & Route Tracker
          </p>
        </div>
      </div>

      {/* Main View Switcher */}
      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
        <button
          id="tab-view-admin"
          onClick={() => onViewChange('admin')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition ${
            currentView === 'admin'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Live Fleet Map</span>
          {activeEmergencyCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          id="tab-view-rider"
          onClick={() => onViewChange('rider')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold transition ${
            currentView === 'rider'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Rider Phone Transmitter</span>
        </button>
      </div>

      {/* Actions Toolbar */}
      <div className="flex items-center gap-2">
        {/* Add Rider / GPS Link */}
        <button
          id="btn-nav-add-rider"
          onClick={onOpenAddRiderModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Add Rider</span>
        </button>

        {/* Reset Demo Fleet */}
        <button
          id="btn-reset-fleet"
          onClick={onResetFleet}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
          title="Reset sample fleet positions"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Audio Alerts Toggle */}
        <button
          id="btn-toggle-sound"
          onClick={onToggleSound}
          className={`p-2 rounded-xl border transition ${
            soundEnabled
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-400 border-slate-200'
          }`}
          title={soundEnabled ? 'Audio Alerts Enabled' : 'Audio Muted'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
