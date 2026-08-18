import React, { useState, useEffect, useCallback } from 'react';
import { Rider, FleetAlert, FleetStats } from './types';
import { Navbar } from './components/Navbar';
import { AdminMapView } from './components/AdminMapView';
import { RidersListPanel } from './components/RidersListPanel';
import { RiderDrawer } from './components/RiderDrawer';
import { RiderCompanionApp } from './components/RiderCompanionApp';
import { AlertsPanel } from './components/AlertsPanel';
import { AddRiderModal } from './components/AddRiderModal';
import { soundManager } from './utils/audio';
import { 
  subscribeToFleetRiders, 
  subscribeToFleetAlerts, 
  saveLiveGpsPingToFirestore, 
  addRiderToFirestore, 
  deleteRiderFromFirestore, 
  clearAllRidersFromFirestore,
  cleanupDemoDataFromFirestore
} from './services/firebaseFleetService';

export default function App() {
  const [currentView, setCurrentView] = useState<'admin' | 'rider'>('admin');
  const [riders, setRiders] = useState<Rider[]>([]);
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [replayRiderId, setReplayRiderId] = useState<string | null>(null);
  const [isAddRiderModalOpen, setIsAddRiderModalOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Check URL query parameters for direct rider link (?rider=RDR-001)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const riderParam = params.get('rider');
    if (riderParam) {
      setSelectedRiderId(riderParam);
      setCurrentView('rider');
    }
  }, []);

  // Real-time Firestore synchronization & automatic legacy demo data purge
  useEffect(() => {
    // Purge any legacy simulated demo riders so Firestore holds only real data
    cleanupDemoDataFromFirestore();

    // 1. Subscribe to Live Riders in Firestore
    const unsubscribeRiders = subscribeToFleetRiders((firestoreRiders) => {
      setRiders(firestoreRiders);
      const urlParams = new URLSearchParams(window.location.search);
      const urlRider = urlParams.get('rider');

      if (urlRider) {
        setSelectedRiderId(urlRider);
        setCurrentView('rider');
      } else if (firestoreRiders.length > 0) {
        setSelectedRiderId((prev) => (prev && firestoreRiders.some(r => r.id === prev) ? prev : firestoreRiders[0].id));
      } else {
        setSelectedRiderId(null);
        setReplayRiderId(null);
      }
    });

    // 2. Subscribe to Alerts in Firestore
    const unsubscribeAlerts = subscribeToFleetAlerts((firestoreAlerts) => {
      setAlerts(firestoreAlerts);
    });

    return () => {
      unsubscribeRiders();
      unsubscribeAlerts();
    };
  }, []);

  // Update Rider Location (Transmitter -> Firestore & Local Node)
  const handleLocationUpdate = async (
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
  ) => {
    // 1. Save directly to Firebase Firestore
    try {
      await saveLiveGpsPingToFirestore(riderId, locationData);
    } catch (err) {
      console.warn('Firestore live save:', err);
    }

    // 2. Also notify Express backend for immediate in-memory cache
    try {
      await fetch(`/api/riders/${riderId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
      });
    } catch (err) {
      // Ignored
    }
  };

  // Update Rider Status
  const handleStatusUpdate = async (riderId: string, status: Rider['status'], reason?: string) => {
    try {
      await fetch(`/api/riders/${riderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, sosReason: reason }),
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Add Single Real Rider
  const handleAddRider = async (riderData: {
    name: string;
    phone: string;
    vehicleType: Rider['vehicleType'];
    vehiclePlate: string;
    city: string;
  }): Promise<Rider | null> => {
    try {
      // Save to Firebase Firestore
      const newRider = await addRiderToFirestore(riderData);
      
      // Also register on local backend
      await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...riderData, id: newRider.id }),
      }).catch(() => {});

      setSelectedRiderId(newRider.id);
      return newRider;
    } catch (err) {
      console.error('Error adding rider:', err);
    }
    return null;
  };

  // Bulk Import Real Riders
  const handleBulkImportRiders = async (ridersList: any[]): Promise<boolean> => {
    try {
      for (const item of ridersList) {
        await addRiderToFirestore(item);
      }
      return true;
    } catch (err) {
      console.error('Error in bulk import:', err);
    }
    return false;
  };

  // Delete a Rider permanently
  const handleDeleteRider = async (riderId: string) => {
    try {
      // Optimistic UI update
      setRiders((prev) => prev.filter((r) => r.id !== riderId));
      if (selectedRiderId === riderId) setSelectedRiderId(null);
      if (replayRiderId === riderId) setReplayRiderId(null);

      await deleteRiderFromFirestore(riderId);
      await fetch(`/api/riders/${riderId}`, { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      console.error('Error deleting rider:', err);
    }
  };

  // Clear All Riders (Clean Start)
  const handleClearAllRiders = async () => {
    try {
      // Optimistic UI update
      setRiders([]);
      setSelectedRiderId(null);
      setReplayRiderId(null);
      setAlerts([]);

      await clearAllRidersFromFirestore();
      await fetch('/api/riders-clear-all', { method: 'DELETE' }).catch(() => {});
    } catch (err) {
      console.error('Error clearing fleet:', err);
    }
  };

  // Remote Buzzer Nudge
  const handleNudgeRider = async (riderId: string) => {
    try {
      await fetch(`/api/riders/${riderId}/nudge`, { method: 'POST' });
    } catch (err) {
      console.error('Error nudging rider:', err);
    }
  };

  // Resolve Alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  const selectedRider = riders.find((r) => r.id === selectedRiderId) || null;
  const activeEmergencies = alerts.filter((a) => a.type === 'sos' && !a.resolved).length;
  const activeMovingCount = riders.filter((r) => r.speed > 2 || r.status === 'moving').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden font-sans select-none">
      {/* Clean Top Navigation Bar */}
      <Navbar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onOpenAddRiderModal={() => setIsAddRiderModalOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        activeEmergencyCount={activeEmergencies}
        activeMovingCount={activeMovingCount}
        totalRiders={riders.length}
      />

      {/* Main View Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIEW 1: LIVE MAP & FLEET TRACKING */}
        {currentView === 'admin' && (
          <main className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
            {/* Left: Clean Riders List & Search */}
            <RidersListPanel
              riders={riders}
              selectedRiderId={selectedRiderId}
              onSelectRider={(id) => {
                setSelectedRiderId(id);
                setReplayRiderId(null);
              }}
              onOpenAddRiderModal={() => setIsAddRiderModalOpen(true)}
              onStartRouteReplay={(id) => {
                setSelectedRiderId(id);
                setReplayRiderId(id);
              }}
              onOpenDirectRiderLink={(id) => {
                setSelectedRiderId(id);
                setIsAddRiderModalOpen(true);
              }}
              onDeleteRider={handleDeleteRider}
              onClearAllRiders={handleClearAllRiders}
            />

            {/* Center: Clean Light Leaflet Map */}
            <div className="flex-1 h-full flex flex-col relative overflow-hidden">
              <div className="flex-1 w-full h-full relative">
                <AdminMapView
                  riders={riders}
                  selectedRiderId={selectedRiderId}
                  onSelectRider={(id) => {
                    setSelectedRiderId(id);
                  }}
                  activeFilter="all"
                  replayRiderId={replayRiderId}
                  onCloseReplay={() => setReplayRiderId(null)}
                />
              </div>

              {/* Floating Bottom Alerts Bar */}
              {alerts.some((a) => !a.resolved) && (
                <div className="absolute bottom-4 left-4 right-4 md:right-auto z-[400]">
                  <AlertsPanel
                    alerts={alerts}
                    onResolveAlert={handleResolveAlert}
                    onFocusRider={(id) => {
                      setSelectedRiderId(id);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Right: Rider Telemetry & Movement History Side Drawer */}
            {selectedRider && !replayRiderId && (
              <RiderDrawer
                rider={selectedRider}
                onClose={() => setSelectedRiderId(null)}
                onNudgeRider={handleNudgeRider}
                onStartRouteReplay={(rId) => {
                  setReplayRiderId(rId);
                }}
                onOpenShareModal={() => setIsAddRiderModalOpen(true)}
                onDeleteRider={handleDeleteRider}
              />
            )}
          </main>
        )}

        {/* VIEW 2: RIDER MOBILE GPS TRANSMITTER */}
        {currentView === 'rider' && (
          <main className="w-full h-full flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-100">
            <RiderCompanionApp
              riders={riders}
              onLocationUpdate={handleLocationUpdate}
              onStatusUpdate={handleStatusUpdate}
              onCreateNewDeviceRider={(name, phone, vehicleType) =>
                handleAddRider({ name, phone, vehicleType, vehiclePlate: 'GPS-LIVE', city: 'Karachi' }).then(
                  (r) => r || riders[0]
                )
              }
              initialRiderId={selectedRiderId || undefined}
              onSwitchToAdmin={() => setCurrentView('admin')}
            />
          </main>
        )}
      </div>

      {/* Add Rider & Share GPS Link Modal */}
      <AddRiderModal
        isOpen={isAddRiderModalOpen}
        onClose={() => setIsAddRiderModalOpen(false)}
        onAddRider={handleAddRider}
        onBulkImportRiders={handleBulkImportRiders}
        onClearAllRiders={handleClearAllRiders}
        totalFleetCount={riders.length}
      />
    </div>
  );
}
