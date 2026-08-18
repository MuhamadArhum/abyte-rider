import React, { useState } from 'react';
import { Rider, VehicleType } from '../types';
import { 
  X, 
  UserPlus, 
  Smartphone, 
  Copy, 
  Check, 
  MessageCircle, 
  FileSpreadsheet, 
  Trash2, 
  QrCode, 
  ExternalLink,
  Info,
  Share2
} from 'lucide-react';
import { getDirectRiderUrl, getPublicRiderUrl, getQrCodeUrl } from '../utils/urlHelper';

interface AddRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRider: (riderData: {
    name: string;
    phone: string;
    vehicleType: VehicleType;
    vehiclePlate: string;
    city: string;
  }) => Promise<Rider | null>;
  onBulkImportRiders?: (ridersList: any[]) => Promise<boolean>;
  onClearAllRiders?: () => Promise<void>;
  totalFleetCount?: number;
}

export const AddRiderModal: React.FC<AddRiderModalProps> = ({
  isOpen,
  onClose,
  onAddRider,
  onBulkImportRiders,
  onClearAllRiders,
  totalFleetCount = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'manage'>('single');

  // Single Rider State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+92 300 ');
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [vehiclePlate, setVehiclePlate] = useState('KHI-');
  const [city, setCity] = useState('Karachi');
  const [createdRider, setCreatedRider] = useState<Rider | null>(null);
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);
  const [selectedUrlType, setSelectedUrlType] = useState<'direct' | 'public'>('direct');
  const [showQrCode, setShowQrCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Import State
  const [bulkText, setBulkText] = useState(
    `Farhan Malik, +92 300 1122334, KHI-1029, Karachi\nBilal Aslam, +92 321 4455667, KHI-8833, Karachi\nZahid Khan, +92 333 7788990, LHR-4567, Lahore`
  );
  const [bulkSuccessCount, setBulkSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    const newRider = await onAddRider({
      name,
      phone,
      vehicleType,
      vehiclePlate,
      city,
    });
    setIsSubmitting(false);

    if (newRider) {
      setCreatedRider(newRider);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim() || !onBulkImportRiders) return;

    setIsSubmitting(true);
    const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
    const parsedList = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        name: parts[0] || 'Rider',
        phone: parts[1] || '+92 300 0000000',
        vehiclePlate: parts[2] || 'GPS-LIVE',
        city: parts[3] || 'Karachi',
        vehicleType: 'bike',
      };
    });

    const success = await onBulkImportRiders(parsedList);
    setIsSubmitting(false);
    if (success) {
      setBulkSuccessCount(parsedList.length);
      setTimeout(() => {
        setBulkSuccessCount(null);
        onClose();
      }, 1800);
    }
  };

  const currentActiveUrl = createdRider 
    ? (selectedUrlType === 'direct' ? getDirectRiderUrl(createdRider.id) : getPublicRiderUrl(createdRider.id))
    : '';

  const handleCopyLink = (url: string, type: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLinkType(type);
    setTimeout(() => setCopiedLinkType(null), 2000);
  };

  const handleWhatsAppShare = (rider: Rider) => {
    const url = currentActiveUrl;
    const message = encodeURIComponent(
      `Assalam-o-Alaikum ${rider.name},\n\nAapki 24/7 Live GPS tracking link active hai. Shift shuru krty waqt is link ko mobile main open krein aur "Allow Location" karein:\n${url}`
    );
    window.open(`https://api.whatsapp.com/send?phone=${rider.phone.replace(/[^0-9]/g, '')}&text=${message}`, '_blank');
  };

  const handleResetModal = () => {
    setCreatedRider(null);
    setName('');
    setPhone('+92 300 ');
    setVehiclePlate('KHI-');
    setBulkSuccessCount(null);
    setShowQrCode(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              {createdRider ? 'Rider GPS Tracking Link & QR' : 'Manage & Add Real Riders'}
            </h3>
            <p className="text-xs text-slate-500">
              {createdRider ? 'Share link or scan QR code on rider phone' : 'Input your actual fleet information'}
            </p>
          </div>
          <button
            onClick={handleResetModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation if not showing created rider result */}
        {!createdRider && (
          <div className="flex border-b border-slate-200 bg-slate-100/60 text-xs px-5 pt-2 gap-2">
            <button
              onClick={() => setActiveTab('single')}
              className={`pb-2 px-3 font-bold border-b-2 transition ${
                activeTab === 'single'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + Single Rider
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`pb-2 px-3 font-bold border-b-2 transition ${
                activeTab === 'bulk'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Bulk Add (Paste List)
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`pb-2 px-3 font-bold border-b-2 transition ${
                activeTab === 'manage'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Clean Start
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {createdRider ? (
            <div className="space-y-4">
              {/* Success Badge */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">{createdRider.name} Registered!</h4>
                    <p className="text-[11px] text-emerald-800">
                      ID: <span className="font-mono font-bold">{createdRider.id}</span> • Bike: <b>{createdRider.vehiclePlate}</b>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowQrCode(!showQrCode)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                    showQrCode ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-800'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{showQrCode ? 'Hide QR' : 'Scan QR'}</span>
                </button>
              </div>

              {/* QR Code Scanner View */}
              {showQrCode && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in">
                  <p className="text-xs font-bold text-slate-800">Scan with Rider's Mobile Camera:</p>
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img
                      src={getQrCodeUrl(currentActiveUrl)}
                      alt="Rider Tracking QR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Rider apne camera se scan karega to direct transmitter page khul jayega.
                  </p>
                </div>
              )}

              {/* URL Type Switcher */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700">Choose Link Type:</label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setSelectedUrlType('direct')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition ${
                        selectedUrlType === 'direct'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Direct Link (Default)
                    </button>
                    <button
                      onClick={() => setSelectedUrlType('public')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition ${
                        selectedUrlType === 'public'
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Public Share (ais-pre)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={currentActiveUrl}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(currentActiveUrl, 'main')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    {copiedLinkType === 'main' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLinkType === 'main' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Guidance Note */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <b>Agar Link par 404 ya 403 error aaye:</b>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-blue-800">
                    <li>Top-Right me <b>"Share"</b> button daba kar public publish karein, ya</li>
                    <li>Rider ko <b>Direct Link</b> bhej kar usi browser me open karne ko bolein, ya</li>
                    <li>Upar <b>"Scan QR"</b> button daba kar mobile camera se scan karein.</li>
                  </ul>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleWhatsAppShare(createdRider)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Link</span>
                </button>

                <button
                  onClick={() => window.open(currentActiveUrl, '_blank')}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Open in new tab to test"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Now</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setCreatedRider(null);
                  setName('');
                  setPhone('+92 300 ');
                  setShowQrCode(false);
                }}
                className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs transition"
              >
                + Add Another Rider
              </button>
            </div>
          ) : activeTab === 'single' ? (
            /* Single Rider Form */
            <form onSubmit={handleSubmitSingle} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rider Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asad Ullah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bike / Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="bike">Motorcycle (Bike)</option>
                    <option value="scooter">Electric Scooter</option>
                    <option value="car">Car</option>
                    <option value="van">Delivery Van</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Base</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="Karachi">Karachi</option>
                    <option value="Lahore">Lahore</option>
                    <option value="Islamabad">Islamabad</option>
                    <option value="Rawalpindi">Rawalpindi</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Registering...' : 'Add Real Rider & Generate GPS Link'}</span>
                </button>
              </div>
            </form>
          ) : activeTab === 'bulk' ? (
            /* Bulk Import Tab */
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paste Rider List (Format: Name, Phone, BikePlate, City)
                </label>
                <textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  placeholder="Name, Phone, Plate, City (One per line)"
                />
              </div>

              {bulkSuccessCount !== null && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center">
                  ✅ Successfully added {bulkSuccessCount} real riders to fleet!
                </div>
              )}

              <button
                onClick={handleBulkImport}
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isSubmitting ? 'Importing...' : 'Bulk Add Riders'}</span>
              </button>
            </div>
          ) : (
            /* Clean Start / Clear Demo Fleet Tab */
            <div className="space-y-4 text-center py-2">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Start 100% Clean Fleet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Agar aap demo riders ko remove karke sirf apne real riders daalna chahty hain to neechay button dabayein:
                </p>
              </div>

              {onClearAllRiders && (
                <button
                  onClick={async () => {
                    await onClearAllRiders();
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Clear Demo Data & Start Fresh
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
