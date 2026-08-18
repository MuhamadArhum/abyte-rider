import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Rider, GeofenceZone, BreadcrumbPoint } from '../types';
import { 
  Compass, 
  Layers, 
  Crosshair, 
  ShieldAlert, 
  Maximize2,
  Play,
  Pause,
  RotateCcw,
  X
} from 'lucide-react';

interface AdminMapViewProps {
  riders: Rider[];
  selectedRiderId: string | null;
  onSelectRider: (riderId: string) => void;
  activeFilter: string;
  onResetFleet: () => void;
  replayRiderId?: string | null;
  onCloseReplay?: () => void;
}

const GEOFENCE_ZONES: GeofenceZone[] = [
  {
    id: 'GEO-1',
    name: 'Karachi Central Core (Express Zone)',
    center: { lat: 24.8607, lng: 67.0011 },
    radiusMeters: 5500,
    color: '#2563eb',
  },
  {
    id: 'GEO-2',
    name: 'Clifton & DHA Coastal Hub',
    center: { lat: 24.8138, lng: 67.0496 },
    radiusMeters: 4500,
    color: '#059669',
  },
  {
    id: 'GEO-3',
    name: 'Gulshan / East Logistics Corridor',
    center: { lat: 24.9180, lng: 67.0971 },
    radiusMeters: 6000,
    color: '#7c3aed',
  },
];

const MAP_TILES = {
  streets: {
    name: 'Street View',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  osm: {
    name: 'Standard OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
  dark: {
    name: 'Night View',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO',
  },
};

export const AdminMapView: React.FC<AdminMapViewProps> = ({
  riders,
  selectedRiderId,
  onSelectRider,
  activeFilter,
  onResetFleet,
  replayRiderId,
  onCloseReplay,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const breadcrumbLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const replayLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeTileKey, setActiveTileKey] = useState<keyof typeof MAP_TILES>('streets');
  const [showGeofences, setShowGeofences] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);

  // Route Replay State
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeReplayRider = riders.find((r) => r.id === (replayRiderId || selectedRiderId));
  const replayHistory: BreadcrumbPoint[] = activeReplayRider?.history || [];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const defaultCenter: [number, number] = [24.8607, 67.0011];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const tileInfo = MAP_TILES[activeTileKey];
    const tileLayer = L.tileLayer(tileInfo.url, {
      attribution: tileInfo.attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    geofenceLayerRef.current = L.layerGroup().addTo(map);
    breadcrumbLayerRef.current = L.layerGroup().addTo(map);
    replayLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const tileInfo = MAP_TILES[activeTileKey];
    tileLayerRef.current.setUrl(tileInfo.url);
  }, [activeTileKey]);

  // Render Geofence Zones
  useEffect(() => {
    if (!geofenceLayerRef.current) return;
    geofenceLayerRef.current.clearLayers();

    if (!showGeofences) return;

    GEOFENCE_ZONES.forEach((zone) => {
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: '4, 8',
        radius: zone.radiusMeters,
      });

      circle.bindTooltip(
        `<div class="text-xs font-bold px-1.5 py-0.5 text-slate-800">${zone.name}</div>`,
        { permanent: false, direction: 'center', className: 'bg-white rounded-lg shadow-sm border border-slate-200' }
      );

      geofenceLayerRef.current?.addLayer(circle);
    });
  }, [showGeofences]);

  // Render Riders and Live Breadcrumbs
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !breadcrumbLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    breadcrumbLayerRef.current.clearLayers();

    const filteredRiders = riders.filter((r) => {
      if (activeFilter === 'all') return true;
      return r.status === activeFilter;
    });

    // If a rider is selected and NOT actively replaying, draw their live breadcrumb trail
    const selectedRider = riders.find((r) => r.id === selectedRiderId);
    if (selectedRider && selectedRider.history && selectedRider.history.length > 1 && !isReplaying) {
      const latLngs: [number, number][] = selectedRider.history.map((pt) => [pt.lat, pt.lng]);
      
      // Outer glow line
      const glowLine = L.polyline(latLngs, {
        color: '#059669',
        weight: 6,
        opacity: 0.2,
      });
      breadcrumbLayerRef.current.addLayer(glowLine);

      // Inner vibrant line
      const pathLine = L.polyline(latLngs, {
        color: '#10b981',
        weight: 3.5,
        opacity: 0.95,
      });
      breadcrumbLayerRef.current.addLayer(pathLine);

      // Starting point pin
      const startPt = selectedRider.history[0];
      const startIcon = L.divIcon({
        className: 'custom-start-pin',
        html: `
          <div class="flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-emerald-600 text-emerald-700 font-extrabold text-[9px] shadow-md">
            S
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const startMarker = L.marker([startPt.lat, startPt.lng], { icon: startIcon });
      startMarker.bindTooltip('<div class="text-xs font-bold text-slate-800">Shift Route Start</div>');
      breadcrumbLayerRef.current.addLayer(startMarker);

      // Auto-follow selected rider if enabled
      if (autoFollow && !isReplaying) {
        mapInstanceRef.current.panTo([selectedRider.location.lat, selectedRider.location.lng], {
          animate: true,
          duration: 0.8,
        });
      }
    }

    // Add markers for all visible riders
    filteredRiders.forEach((rider) => {
      const isSelected = rider.id === selectedRiderId;
      const isEmergency = rider.status === 'emergency';
      const isMoving = rider.speed > 2 || rider.status === 'moving';

      let pulseClass = '';
      let ringColor = 'border-slate-400';
      let speedBadgeBg = 'bg-slate-800 text-white';

      if (isEmergency) {
        pulseClass = 'radar-pulse-emergency';
        ringColor = 'border-rose-600 ring-4 ring-rose-500/30';
        speedBadgeBg = 'bg-rose-600 text-white';
      } else if (isMoving) {
        pulseClass = 'radar-pulse-online';
        ringColor = 'border-emerald-600 ring-4 ring-emerald-500/20';
        speedBadgeBg = 'bg-emerald-700 text-white';
      } else if (rider.status === 'idle') {
        ringColor = 'border-amber-500';
        speedBadgeBg = 'bg-amber-600 text-white';
      }

      const markerHtml = `
        <div class="relative group cursor-pointer transition-transform duration-300 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}">
          <!-- Pulse Circle -->
          <div class="w-11 h-11 rounded-full flex items-center justify-center shadow-lg bg-white border-2 ${ringColor} ${pulseClass}">
            <!-- Vehicle Avatar -->
            <div class="relative w-8 h-8 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-100">
              <img src="${rider.avatar}" alt="${rider.name}" class="w-full h-full object-cover" />
            </div>

            <!-- Direction Indicator Pointer -->
            <div 
              class="absolute -top-1 w-2.5 h-2.5 bg-emerald-700 border border-white rounded-xs shadow"
              style="transform: rotate(${rider.heading}deg) translateY(-8px);"
            ></div>
          </div>

          <!-- Speed & Name Floating Tag -->
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-none">
            <div class="flex items-center gap-1 px-2 py-0.5 rounded-full ${speedBadgeBg} shadow-md text-[10px] font-bold">
              <span>${rider.speed > 0 ? `${rider.speed} km/h` : 'Stopped'}</span>
              <span class="opacity-60">|</span>
              <span class="max-w-[70px] truncate">${rider.name.split(' ')[0]}</span>
            </div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-rider-marker',
        html: markerHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([rider.location.lat, rider.location.lng], { icon: customIcon });

      marker.on('click', () => {
        onSelectRider(rider.id);
      });

      // Quick hover tooltip
      marker.bindTooltip(
        `
        <div class="p-1 space-y-1 text-xs font-sans">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <span>${rider.name}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${speedBadgeBg}">${rider.status}</span>
          </div>
          <div class="text-slate-600 flex items-center justify-between gap-3 text-[11px]">
            <span>Speed: <b>${rider.speed} km/h</b></span>
            <span>Battery: <b>${rider.batteryLevel}%</b></span>
          </div>
          <div class="text-slate-500 text-[10px]">${rider.location.address || 'Active GPS Pin'}</div>
        </div>
        `,
        { direction: 'top', offset: [0, -20], opacity: 0.95 }
      );

      markersLayerRef.current?.addLayer(marker);
    });
  }, [riders, selectedRiderId, activeFilter, autoFollow, isReplaying]);

  // Route Replay Ticker & Animation Effect
  useEffect(() => {
    if (!isReplaying || !replayLayerRef.current || replayHistory.length === 0) return;

    const intervalMs = Math.max(300, 1500 / replaySpeed);
    replayTimerRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replayHistory.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (replayTimerRef.current) clearInterval(replayTimerRef.current);
    };
  }, [isReplaying, replaySpeed, replayHistory.length]);

  // Render Replay Progress on Map
  useEffect(() => {
    if (!replayLayerRef.current || !mapInstanceRef.current || replayHistory.length === 0) return;

    replayLayerRef.current.clearLayers();

    if (replayRiderId || isReplaying || replayIndex > 0) {
      // Draw full grey path as background
      const fullLatLngs: [number, number][] = replayHistory.map((pt) => [pt.lat, pt.lng]);
      const fullPath = L.polyline(fullLatLngs, {
        color: '#94a3b8',
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 5',
      });
      replayLayerRef.current.addLayer(fullPath);

      // Draw replayed path in bright cyan/emerald
      const traversedLatLngs = fullLatLngs.slice(0, replayIndex + 1);
      if (traversedLatLngs.length > 1) {
        const activePath = L.polyline(traversedLatLngs, {
          color: '#0284c7',
          weight: 4,
          opacity: 0.95,
        });
        replayLayerRef.current.addLayer(activePath);
      }

      // Current replay animated vehicle pin
      const currentPoint = replayHistory[replayIndex] || replayHistory[0];
      if (currentPoint) {
        const replayVehicleHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-lg ring-4 ring-sky-400/30 animate-pulse">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900 text-white font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
              ${currentPoint.speed} km/h
            </div>
          </div>
        `;

        const replayIcon = L.divIcon({
          className: 'custom-replay-marker',
          html: replayVehicleHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const replayMarker = L.marker([currentPoint.lat, currentPoint.lng], { icon: replayIcon });
        replayLayerRef.current.addLayer(replayMarker);

        mapInstanceRef.current.panTo([currentPoint.lat, currentPoint.lng], { animate: true, duration: 0.5 });
      }
    }
  }, [replayIndex, replayHistory, replayRiderId, isReplaying]);

  // Center on all riders
  const handleFitAllRiders = () => {
    if (!mapInstanceRef.current || riders.length === 0) return;
    const group = L.featureGroup(
      riders.map((r) => L.marker([r.location.lat, r.location.lng]))
    );
    mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
  };

  const handleStartReplay = () => {
    if (replayIndex >= replayHistory.length - 1) {
      setReplayIndex(0);
    }
    setIsReplaying(true);
  };

  const handlePauseReplay = () => {
    setIsReplaying(false);
  };

  const handleResetReplay = () => {
    setIsReplaying(false);
    setReplayIndex(0);
  };

  const currentReplayPoint = replayHistory[replayIndex] || replayHistory[0];

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Map Control Bar Floating on Top-Left */}
      <div className="absolute top-4 left-4 z-[400] flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-md text-xs">
        {/* Layer Styles */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
          {(Object.keys(MAP_TILES) as Array<keyof typeof MAP_TILES>).map((key) => (
            <button
              key={key}
              id={`btn-map-tile-${key}`}
              onClick={() => setActiveTileKey(key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeTileKey === key
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {MAP_TILES[key].name}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* Fit Bounds */}
        <button
          id="btn-fit-fleet"
          onClick={handleFitAllRiders}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-bold transition shadow-xs"
          title="Fit all fleet on map"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Fit All</span>
        </button>

        {/* Geofence Toggle */}
        <button
          id="btn-toggle-geofence"
          onClick={() => setShowGeofences(!showGeofences)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold transition shadow-xs ${
            showGeofences
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Toggle Zones"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Zones</span>
        </button>

        {/* Auto Follow Toggle */}
        {selectedRiderId && (
          <button
            id="btn-toggle-autofollow"
            onClick={() => setAutoFollow(!autoFollow)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold transition shadow-xs ${
              autoFollow
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Follow</span>
          </button>
        )}
      </div>

      {/* Floating Fleet Quick Stats Badge Top-Right */}
      <div className="absolute top-4 right-14 z-[400] hidden md:flex items-center gap-2.5 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-md text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-slate-800 font-bold">24/7 Live Feed</span>
        </div>
        <div className="h-3.5 w-px bg-slate-200" />
        <div className="text-slate-600">
          Active: <span className="font-extrabold text-slate-900">{riders.filter(r => r.status !== 'offline').length} / {riders.length}</span>
        </div>
      </div>

      {/* Route Replay Controller Floating Bar at Bottom */}
      {(replayRiderId || isReplaying || (selectedRiderId && replayHistory.length > 1)) && (
        <div className="absolute bottom-6 left-4 right-4 md:left-auto md:right-auto md:w-[560px] md:translate-x-1/2 md:right-1/2 z-[400] bg-white/95 backdrop-blur-lg border border-sky-300 rounded-2xl p-3.5 shadow-xl animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700 border border-sky-200">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Route Replay: {activeReplayRider?.name}</span>
                  <span className="text-[10px] text-sky-700 font-mono">({activeReplayRider?.vehiclePlate})</span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  Step {replayIndex + 1} of {replayHistory.length} • Speed: {currentReplayPoint?.speed || 0} km/h
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setReplaySpeed(speed)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition ${
                    replaySpeed === speed
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}

              {onCloseReplay && (
                <button
                  onClick={() => {
                    setIsReplaying(false);
                    onCloseReplay();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                  title="Close Route Replay"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Scrubber Progress Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, replayHistory.length - 1)}
              value={replayIndex}
              onChange={(e) => {
                setReplayIndex(Number(e.target.value));
              }}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>Start ({replayHistory[0] ? new Date(replayHistory[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'})</span>
              <span className="text-sky-700 font-semibold">{currentReplayPoint?.address || 'Street Coordinates'}</span>
              <span>Now ({replayHistory[replayHistory.length - 1] ? new Date(replayHistory[replayHistory.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'})</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={handleResetReplay}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
              title="Reset to Start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {isReplaying ? (
              <button
                onClick={handlePauseReplay}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={handleStartReplay}
                className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Play className="w-4 h-4" />
                <span>{replayIndex >= replayHistory.length - 1 ? 'Replay Route' : 'Play Movement'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* The Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
};
