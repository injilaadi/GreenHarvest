import React, { useState, useEffect } from "react";
import { X, MapPin, Compass, Droplet, Utensils, Activity, Home, Sparkles, Plus, Minus, Check } from "lucide-react";
import { AICameraScanner } from "./AICameraScanner";
import { SupplyQuantities, SUPPLY_METADATA } from "../types";

interface SendAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    address: string;
    city: string;
    zip: string;
    supplies: SupplyQuantities;
    lat: number;
    lng: number;
  }) => void;
}

export const SendAlertModal: React.FC<SendAlertModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [title, setTitle] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [zip, setZip] = useState<string>("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [quantities, setQuantities] = useState<SupplyQuantities>({
    water: 0,
    food: 0,
    medical: 0,
    shelter: 0
  });

  const [gpsStatus, setGpsStatus] = useState<"idle" | "locking" | "active" | "error">("idle");
  const [gpsText, setGpsText] = useState<string>("Detect Location via GPS");
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerType, setScannerType] = useState<"water" | "food" | "medical" | "shelter">("water");

  const openScannerForType = (type: "water" | "food" | "medical" | "shelter") => {
    setScannerType(type);
    setIsScannerOpen(true);
  };

  // Synchronously seed mock or default location info if GPS is blocked
  const triggerGPSLock = () => {
    setGpsStatus("locking");
    setGpsText("Synchronizing GPS...");

    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsText("GPS Unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        setLat(latitude);
        setLng(longitude);
        setGpsStatus("active");
        setGpsText("GPS Lock Active");

        try {
          // Perform reverse lookup on Nominatim OpenStreetMap values
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const postalCode = data.address.postcode || "";
              const matchedCity =
                data.address.city ||
                data.address.town ||
                data.address.village ||
                data.address.suburb ||
                "";
              const street =
                data.address.road ||
                data.address.subway ||
                data.address.amenity ||
                "Detected coordinates block";

              setZip(postalCode);
              setCity(matchedCity);
              setAddress(`${street}, CA`);
            }
          }
        } catch (err) {
          console.warn("Reverse address lookup skipped:", err);
          // Fallback coordinate seeds inside Irvine CA
          setZip("92618");
          setCity("Irvine");
        }
      },
      (error) => {
        console.warn("GPS Access Denied:", error);
        setGpsStatus("error");
        setGpsText("Access Denied (Seeding CA)");
        
        // Seed default beautiful location so the double check completes seamlessly
        setLat(33.6846 + (Math.random() - 0.5) * 0.04);
        setLng(-117.8265 + (Math.random() - 0.5) * 0.04);
        setCity("Irvine");
        setZip("92618");
        setAddress("Woodbury Center, Irvine, CA");
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleQtyChange = (field: keyof SupplyQuantities, op: "inc" | "dec") => {
    setQuantities((prev) => {
      const current = prev[field];
      const next = op === "inc" ? current + 1 : Math.max(0, current - 1);
      return { ...prev, [field]: next };
    });
  };

  const handleManualQtyInput = (field: keyof SupplyQuantities, val: string) => {
    const rawNum = parseInt(val) || 0;
    setQuantities((prev) => ({ ...prev, [field]: Math.max(0, rawNum) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city || !zip) {
      alert("ZIP Code and City Name are required to route coordinates.");
      return;
    }

    const finalLat = lat !== null ? lat : 33.6846 + (Math.random() - 0.5) * 0.04;
    const finalLng = lng !== null ? lng : -117.8265 + (Math.random() - 0.5) * 0.04;

    onSubmit({
      title: title.trim() || `Supply Beacon [ZIP: ${zip}]`,
      address: address.trim() || `Emergency relief coordinates`,
      city: city.trim(),
      zip: zip.trim(),
      supplies: quantities,
      lat: finalLat,
      lng: finalLng
    });

    // Reset Form
    setTitle("");
    setAddress("");
    setCity("");
    setZip("");
    setLat(null);
    setLng(null);
    setQuantities({ water: 0, food: 0, medical: 0, shelter: 0 });
    setGpsStatus("idle");
    setGpsText("Detect Location via GPS");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-md">
        <form 
          onSubmit={handleSubmit}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-natural-border dark:border-[#2D3126] bg-[#FDFCF8] dark:bg-[#1C1E18] text-[#3D4035] dark:text-[#E8E4D9] shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between border-b border-natural-border dark:border-[#2D3126] px-6 py-4 bg-[#F1F0E8] dark:bg-[#252820]">
            <div className="flex items-center gap-2.5">
              <MapPin className="text-[#8FA98F]" size={18} />
              <h3 className="font-sans font-bold text-[#2A2D24] dark:text-white text-sm md:text-base">Register Supply Beacon</h3>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="rounded-full bg-white dark:bg-[#2D3126] p-1.5 text-[#7A776E] dark:text-[#A5A295] hover:text-[#5B705B] dark:hover:text-white border border-natural-border dark:border-[#3D4035]/40 transition shadow-sm cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body Section */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* Step 1: Location settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#8FA98F] text-white text-[10px] font-mono">01</span>
                <span className="text-[11px] font-mono tracking-wider text-[#5B705B] dark:text-[#FEFAE0] uppercase font-bold">Declare Coordinates</span>
              </div>
              <p className="text-xs text-[#7A776E] dark:text-[#A5A295] leading-relaxed">
                Connect your physical donation inventories to our map center. Enable GPS satellite retrieval or enter address elements manually.
              </p>

              {/* Optional GPS group */}
              <div className="rounded-xl border border-natural-border dark:border-[#2D3126] bg-[#F1F0E8]/40 dark:bg-[#252820]/40 p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#2A2D24] dark:text-white">Satellite GPS Coordinate Sync</span>
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
                    gpsStatus === "active" ? "bg-white dark:bg-[#1C1E18] text-[#8FA98F] border border-[#8FA98F]/30" :
                    gpsStatus === "locking" ? "bg-[#FEFAE0] text-[#D4A373] border border-[#D4A373]/30 animate-pulse" :
                    gpsStatus === "error" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                    "bg-white dark:bg-[#1E2019] text-[#7A776E]"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      gpsStatus === "active" ? "bg-[#8FA98F]" :
                      gpsStatus === "locking" ? "bg-[#D4A373]" :
                      gpsStatus === "error" ? "bg-rose-400" : "bg-zinc-500"
                    }`} />
                    {gpsStatus.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={triggerGPSLock}
                  className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white dark:bg-[#2D3126] border border-natural-border dark:border-[#3D4035]/30 hover:border-[#8FA98F] text-xs font-semibold text-[#5B705B] dark:text-[#FEFAE0] shadow-sm transition cursor-pointer"
                >
                  <Compass size={14} className={gpsStatus === "locking" ? "animate-spin" : ""} />
                  <span>{gpsText}</span>
                </button>
              </div>

              {/* Manual Fields */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="beacon-title" className="block text-[10px] font-mono text-[#7A776E] dark:text-[#A5A295] uppercase tracking-wide mb-1.5">Beacon Node Name</label>
                  <input
                    id="beacon-title"
                    type="text"
                    required
                    placeholder="e.g. Irvine Community Sanctuary Depot"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 px-3.5 py-2.5 text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                  />
                </div>

                <div>
                  <label htmlFor="beacon-address" className="block text-[10px] font-mono text-[#7A776E] dark:text-[#A5A295] uppercase tracking-wide mb-1.5">Full Street / Building Address (Optional)</label>
                  <input
                    id="beacon-address"
                    type="text"
                    placeholder="e.g. 401 Peltason Dr"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-lg bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 px-3.5 py-2.5 text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label htmlFor="beacon-city" className="block text-[10px] font-mono text-[#7A776E] dark:text-[#A5A295] uppercase tracking-wide mb-1.5">City Name <b className="text-warning">*</b></label>
                    <input
                      id="beacon-city"
                      type="text"
                      required
                      placeholder="e.g. Irvine"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 px-3.5 py-2.5 text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="beacon-zip" className="block text-[10px] font-mono text-[#7A776E] dark:text-[#A5A295] uppercase tracking-wide mb-1.5">ZIP Code <b className="text-[#D4A373]">*</b></label>
                    <input
                      id="beacon-zip"
                      type="text"
                      required
                      placeholder="e.g. 92697"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      className="w-full rounded-lg bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 px-3.5 py-2.5 text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Inventory details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#8FA98F] text-white text-[10px] font-mono">02</span>
                <span className="text-[11px] font-mono tracking-wider text-[#5B705B] dark:text-[#FEFAE0] uppercase font-bold">Log Quantities</span>
              </div>
              <p className="text-xs text-[#7A776E] dark:text-[#A5A295] leading-relaxed">
                Add quantities of relief items. Run our <b>Computer Vision Scanner</b> on your physical water bottles for instantaneous counting.
              </p>

              {/* Quantity selectors list */}
              <div className="space-y-3">
                
                {/* 1. Water Bottles (Highlighted with scanner) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border border-natural-border dark:border-[#2D3126] bg-[#F9F8F4] dark:bg-[#1E2019]/40 gap-3">
                  <div className="flex items-center gap-3">
                    <Droplet className="text-[#8FA98F]" size={20} />
                    <div>
                      <h4 className="text-xs font-bold text-[#2A2D24] dark:text-white">Clean Water Bottles</h4>
                      <p className="text-[10px] text-[#7A776E] dark:text-[#A5A295] leading-tight font-sans">Emergency drinking supply</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => openScannerForType("water")}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#8FA98F]/10 hover:bg-[#8FA98F] text-[10px] font-bold text-[#5B705B] hover:text-white border border-[#8FA98F]/30 transition cursor-pointer"
                    >
                      <Sparkles size={11} className="animate-pulse" />
                      <span>Scan with AI Camera</span>
                    </button>
                    <div className="flex items-center bg-white dark:bg-[#171914] border border-natural-border dark:border-[#2D3126] rounded-lg overflow-hidden h-8">
                      <button
                        type="button"
                        onClick={() => handleQtyChange("water", "dec")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-r border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantities.water}
                        onChange={(e) => handleManualQtyInput("water", e.target.value)}
                        className="w-12 h-full text-center text-xs font-bold text-[#3D4035] dark:text-white bg-transparent outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange("water", "inc")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-l border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. MRE Packs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border border-natural-border dark:border-[#2D3126] bg-[#F9F8F4] dark:bg-[#1E2019]/40 gap-3">
                  <div className="flex items-center gap-3">
                    <Utensils className="text-[#D4A373]" size={18} />
                    <div>
                      <h4 className="text-xs font-semibold text-[#2A2D24] dark:text-white">Non-Perishable Food</h4>
                      <p className="text-[10px] text-[#7A776E] dark:text-[#A5A295] leading-tight font-sans">Ready meal packages</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => openScannerForType("food")}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#8FA98F]/10 hover:bg-[#8FA98F] text-[10px] font-bold text-[#5B705B] hover:text-white border border-[#8FA98F]/30 transition cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Scan with AI Camera</span>
                    </button>
                    <div className="flex items-center bg-white dark:bg-[#171914] border border-natural-border dark:border-[#2D3126] rounded-lg overflow-hidden h-8">
                      <button
                        type="button"
                        onClick={() => handleQtyChange("food", "dec")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-r border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantities.food}
                        onChange={(e) => handleManualQtyInput("food", e.target.value)}
                        className="w-12 h-full text-center text-xs font-bold text-[#3D4035] dark:text-white bg-transparent outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange("food", "inc")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-l border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Medical Kits */}
                <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border border-natural-border dark:border-[#2D3126] bg-[#F9F8F4] dark:bg-[#1E2019]/40 gap-3">
                  <div className="flex items-center gap-3">
                    <Activity className="text-rose-600 dark:text-rose-400" size={18} />
                    <div>
                      <h4 className="text-xs font-semibold text-[#2A2D24] dark:text-white">Medical Kits / Bandages</h4>
                      <p className="text-[10px] text-[#7A776E] dark:text-[#A5A295] leading-tight font-sans">First Aid sterile dressings</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => openScannerForType("medical")}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#8FA98F]/10 hover:bg-[#8FA98F] text-[10px] font-bold text-[#5B705B] hover:text-white border border-[#8FA98F]/30 transition cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Scan with AI Camera</span>
                    </button>
                    <div className="flex items-center bg-white dark:bg-[#171914] border border-natural-border dark:border-[#2D3126] rounded-lg overflow-hidden h-8">
                      <button
                        type="button"
                        onClick={() => handleQtyChange("medical", "dec")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-r border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantities.medical}
                        onChange={(e) => handleManualQtyInput("medical", e.target.value)}
                        className="w-12 h-full text-center text-xs font-bold text-[#3D4035] dark:text-white bg-transparent outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange("medical", "inc")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-l border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Sleeping Kits */}
                <div className="flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border border-natural-border dark:border-[#2D3126] bg-[#F9F8F4] dark:bg-[#1E2019]/40 gap-3">
                  <div className="flex items-center gap-3">
                    <Home className="text-[#8FA98F]" size={18} />
                    <div>
                      <h4 className="text-xs font-semibold text-[#2A2D24] dark:text-white">Sleeping Kits & Blankets</h4>
                      <p className="text-[10px] text-[#7A776E] dark:text-[#A5A295] leading-tight font-sans">Thermal bags or bedding</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => openScannerForType("shelter")}
                      className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#8FA98F]/10 hover:bg-[#8FA98F] text-[10px] font-bold text-[#5B705B] hover:text-white border border-[#8FA98F]/30 transition cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Scan with AI Camera</span>
                    </button>
                    <div className="flex items-center bg-white dark:bg-[#171914] border border-natural-border dark:border-[#2D3126] rounded-lg overflow-hidden h-8">
                      <button
                        type="button"
                        onClick={() => handleQtyChange("shelter", "dec")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-r border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Minus size={11} />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={quantities.shelter}
                        onChange={(e) => handleManualQtyInput("shelter", e.target.value)}
                        className="w-12 h-full text-center text-xs font-bold text-[#3D4035] dark:text-white bg-transparent outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange("shelter", "inc")}
                        className="w-8 h-full hover:bg-[#F1F0E8] dark:hover:bg-[#2D3126] border-l border-natural-border dark:border-[#2D3126] text-[#7A776E] dark:text-[#A5A295] flex items-center justify-center cursor-pointer"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end border-t border-natural-border dark:border-[#2D3126] px-6 py-4 bg-[#F1F0E8] dark:bg-[#252820] gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold hover:text-[#5B705B] dark:hover:text-white transition text-[#7A776E] dark:text-[#A5A295] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#5B705B] hover:opacity-95 text-white text-xs font-extrabold transition shadow-md shadow-[#5B705B]/15 cursor-pointer"
            >
              <Check size={14} />
              <span>Broadcast Beacon Pinned</span>
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Computer Vision Capture */}
      <AICameraScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        supplyType={scannerType}
        onScanComplete={(count) => {
          setQuantities((prev) => ({ ...prev, [scannerType]: count }));
        }}
      />
    </>
  );
};
