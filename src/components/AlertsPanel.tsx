import React from 'react';
import { FleetAlert } from '../types';
import { ShieldAlert, AlertTriangle, Battery, Gauge, CheckCircle, Navigation, X } from 'lucide-react';
import { formatTimeAgo } from '../utils/geo';

interface AlertsPanelProps {
  alerts: FleetAlert[];
  onResolveAlert: (alertId: string) => void;
  onFocusRider: (riderId: string) => void;
}

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onResolveAlert,
  onFocusRider,
}) => {
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  if (unresolvedAlerts.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-3.5 shadow-lg space-y-2.5 max-w-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <h3 className="font-extrabold text-slate-900 text-xs">
            Fleet Alerts ({unresolvedAlerts.length})
          </h3>
        </div>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {unresolvedAlerts.map((alert) => {
          const isSos = alert.type === 'sos';
          const isSpeeding = alert.type === 'speeding';
          const isLowBattery = alert.type === 'low_battery';

          return (
            <div
              key={alert.id}
              className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 text-xs transition ${
                isSos
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : isSpeeding
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {isSos && <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-bounce" />}
                  {isSpeeding && <Gauge className="w-3.5 h-3.5 text-amber-600" />}
                  {isLowBattery && <Battery className="w-3.5 h-3.5 text-rose-600" />}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs">{alert.riderName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatTimeAgo(alert.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-700">{alert.message}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onFocusRider(alert.riderId)}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 transition shadow-2xs"
                  title="Locate rider on map"
                >
                  Locate
                </button>

                <button
                  onClick={() => onResolveAlert(alert.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Dismiss alert"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
