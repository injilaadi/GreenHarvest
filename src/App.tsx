import React, { useState, useEffect, useRef } from "react";
import { 
  Droplet, 
  Utensils, 
  Activity, 
  Tent, 
  Search, 
  Plus, 
  Compass, 
  Moon, 
  Sun, 
  Sparkles, 
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Info,
  MapPin,
  Bell,
  Phone,
  Trash2,
  Send,
  Check,
  Leaf
} from "lucide-react";
import { MapContainer } from "./components/MapContainer";
import { SendAlertModal } from "./components/SendAlertModal";
import { DonationNode, CategoryFilter, INITIAL_NODES, SUPPLY_METADATA, SMSSubscription } from "./types";

// Haversine formula to compute distance in miles between coordinates
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function App() {
  const [nodes, setNodes] = useState<DonationNode[]>(() => {
    const saved = localStorage.getItem("greenharvest_beacons");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved nodes:", e);
      }
    }
    return INITIAL_NODES;
  });

  // UI state managers
  const [activeTab, setActiveTab] = useState<"home" | "find" | "receive-alerts">("home");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userLocInput, setUserLocInput] = useState<string>("");
  const [userLocStatus, setUserLocStatus] = useState<"idle" | "locking" | "active" | "error">("idle");
  const [searchZip, setSearchZip] = useState<string>("");
  const [searchCity, setSearchCity] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([33.6846, -117.8265]); // Irvine, CA default
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [highlightedCoords, setHighlightedCoords] = useState<[number, number] | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("light");
  const [systemClock, setSystemClock] = useState<string>("00:00:00");
  const [tickerOffset, setTickerOffset] = useState<number>(0);
  const [searchedZone, setSearchedZone] = useState<string | null>(null);

  // SMS Subscriptions management states
  const [smsSubscriptions, setSmsSubscriptions] = useState<SMSSubscription[]>(() => {
    const saved = localStorage.getItem("greenharvest_sms_subscriptions");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse SMS subscriptions:", e);
      }
    }
    return [
      {
        id: "demo_sub_1",
        phone: "+1 (949) 219-4820",
        radius: 3.5,
        lat: 33.6405,
        lng: -117.8443,
        createdAt: "5/27/2026",
        isActive: true
      },
      {
        id: "demo_sub_2",
        phone: "+1 (714) 803-1294",
        radius: 5.0,
        lat: 33.6826,
        lng: -117.8184,
        createdAt: "5/27/2026",
        isActive: true
      }
    ];
  });

  const [subsPhone, setSubsPhone] = useState<string>("");
  const [subsRadius, setSubsRadius] = useState<number>(3.0);
  const [smsInboxLogs, setSmsInboxLogs] = useState<{ id: string; phone: string; message: string; timestamp: string; inbound: boolean }[]>(() => {
    return [
      {
        id: "init_1",
        phone: "+1 (949) 219-4820",
        message: "GreenHarvest: Alert service set for 3.5 mi of UCI Depot matching coordinate center. Send 'X' to cancel.",
        timestamp: "01:10:45 AM",
        inbound: false
      },
      {
        id: "init_2",
        phone: "+1 (714) 803-1294",
        message: "GreenHarvest: Connection setup. Alert updates enabled for Westpark Sector. Reply X key to clear.",
        timestamp: "01:22:15 AM",
        inbound: false
      }
    ];
  });

  // Simulator helper selections
  const [testActiveSubId, setTestActiveSubId] = useState<string>("demo_sub_1");
  const [testReplyMsg, setTestReplyMsg] = useState<string>("X");

  // Keep SMS subscriptions synchronized
  useEffect(() => {
    localStorage.setItem("greenharvest_sms_subscriptions", JSON.stringify(smsSubscriptions));
  }, [smsSubscriptions]);

  // Auto-scrolling stats alerts
  const [alertsLog, setAlertsLog] = useState<string[]>([
    "Node UCI Depot verified 150 water bottles standard stock",
    "Irvine Spectrum Relief Node reports 300 water bottles registered",
    "Telemetry grid online - Orange County Great Park sector responsive",
    "Double ring coordinate marker system active in IrvineCA region",
  ]);

  // LocalStorage sync
  useEffect(() => {
    localStorage.setItem("greenharvest_beacons", JSON.stringify(nodes));
  }, [nodes]);

  // Live UTC or local clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setSystemClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scrolling ticker offset animation (CPU light)
  useEffect(() => {
    const interval = setInterval(() => {
      setTickerOffset((prev) => (prev + 1) % 600);
    }, 60);
    return () => clearInterval(interval);
  }, []);

  const addTickerAlert = (message: string) => {
    setAlertsLog((prev) => [message, ...prev.slice(0, 5)]);
  };

  // Perform search resolving using Nominatim geocoding API
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const zipQuery = searchZip.trim();
    const cityQuery = searchCity.trim();

    if (!zipQuery && !cityQuery) {
      // If empty query, center back to default seeded Region
      setMapCenter([33.6846, -117.8265]);
      setMapZoom(12);
      setHighlightedCoords(null);
      setSearchedZone(null);
      addTickerAlert("Recentered view to general Irvine supply quadrant.");
      return;
    }

    const searchQuery = [zipQuery, cityQuery, "California"].filter(Boolean).join(", ");
    addTickerAlert(`Geocoding coordinates for sector query: [${searchQuery.toUpperCase()}]...`);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const matchedLat = parseFloat(data[0].lat);
          const matchedLon = parseFloat(data[0].lon);

          setMapCenter([matchedLat, matchedLon]);
          setMapZoom(14);
          setHighlightedCoords([matchedLat, matchedLon]);
          setSearchedZone(cityQuery || zipQuery);
          addTickerAlert(`Map focused on cluster grid: [Lat: ${matchedLat.toFixed(4)}, Lon: ${matchedLon.toFixed(4)}]`);
        } else {
          addTickerAlert(`Warning: Sector [${searchQuery.toUpperCase()}] could not be geocoded by OSM.`);
        }
      }
    } catch (err) {
      console.warn("Nominatim Geocoding lookup failed:", err);
      addTickerAlert("OSM lookup error. Resorting to local dataset filtering.");
    }
  };

  // User Self-Location Locking via Browser Location Service
  const handleGPSLocationLock = () => {
    setUserLocStatus("locking");
    addTickerAlert("Requesting browser high-accuracy GPS satellite feed...");
    
    if (!navigator.geolocation) {
      setUserLocStatus("error");
      addTickerAlert("Error: Browser does not support geolocation APIs.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation([lat, lng]);
        setMapCenter([lat, lng]);
        setMapZoom(14);
        setUserLocStatus("active");
        addTickerAlert(`SECURE GPS LOCK: Green dot verified at [Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}]`);
      },
      (error) => {
        console.warn("Geolocation permission or lock failed:", error);
        setUserLocStatus("error");
        addTickerAlert("GPS Lock Blocked: Please type a street/city address below instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // User Self-Location Locking via Street Address Geocoding
  const handleStreetLocationLock = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = userLocInput.trim();
    if (!query) return;

    setUserLocStatus("locking");
    addTickerAlert(`Resolving coordinates for base street: "${query.toUpperCase()}"...`);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setUserLocation([lat, lng]);
          setMapCenter([lat, lng]);
          setMapZoom(14.5);
          setUserLocStatus("active");
          addTickerAlert(`MANUAL BASE PINNED: Green dot accurate at [Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}]`);
        } else {
          setUserLocStatus("error");
          addTickerAlert(`Warning: Node [${query.toUpperCase()}] could not be found by OpenStreetMap geocoder.`);
        }
      }
    } catch (err) {
      console.error(err);
      setUserLocStatus("error");
      addTickerAlert("Geocoding service unavailable. Please retry.");
    }
  };

  // --- SMS SUB SERVICE HANDLERS ---
  const handleSMSSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneClean = subsPhone.trim();
    if (!phoneClean) {
      addTickerAlert("Error: Phone number cannot be blank.");
      return;
    }

    // Convert digits to standard formatted layout
    let formatted = phoneClean;
    const digitsOnly = phoneClean.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      formatted = `+1 (${digitsOnly.slice(0,3)}) ${digitsOnly.slice(3,6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      formatted = `+1 (${digitsOnly.slice(1,4)}) ${digitsOnly.slice(4,7)}-${digitsOnly.slice(7)}`;
    } else if (digitsOnly.length > 0 && !phoneClean.startsWith("+")) {
      formatted = `+1 ${phoneClean}`;
    }

    const centerCoords: [number, number] = userLocation || [33.6846, -117.8265];
    if (!userLocation) {
      // Lazy locate center coordinates
      setUserLocation([33.6846, -117.8265]);
      setMapCenter([33.6846, -117.8265]);
      setMapZoom(13);
      addTickerAlert("Base location synchronized at default Irvine coordinates.");
    }

    const newSub: SMSSubscription = {
      id: `sub_custom_${Date.now()}`,
      phone: formatted,
      radius: subsRadius,
      lat: centerCoords[0],
      lng: centerCoords[1],
      createdAt: new Date().toLocaleDateString(),
      isActive: true
    };

    setSmsSubscriptions((prev) => [...prev, newSub]);
    setTestActiveSubId(newSub.id); // Default simulator selection to new subscriber

    const confirmMsg = `GreenHarvest: Alert channel active! You will receive text alerts for resources mapped within ${subsRadius} miles of your base. Reply 'X' to stop.`;
    setSmsInboxLogs((prev) => [
      {
        id: `com_log_${Date.now()}`,
        phone: formatted,
        message: confirmMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        inbound: false
      },
      ...prev
    ]);

    addTickerAlert(`CELL ALERTS COMMITTED: Configured ${formatted} for a ${subsRadius}mi radius.`);
    setSubsPhone("");
  };

  const removeSubscription = (id: string, phone: string) => {
    setSmsSubscriptions((prev) => prev.filter((s) => s.id !== id));
    setSmsInboxLogs((prev) => [
      {
        id: `unsub_log_${Date.now()}`,
        phone,
        message: "GreenHarvest: SMS alert subscription deleted. Contact removed from subscriber ledger.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        inbound: false
      },
      ...prev
    ]);
    addTickerAlert(`CELL DISMISSED: Alerts stopped for ${phone}`);
  };

  const handleSimulatedSMSInbound = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = smsSubscriptions.find((s) => s.id === testActiveSubId);
    if (!sub) {
      addTickerAlert("Error: Select a cell profile in cellular hub first.");
      return;
    }

    const val = testReplyMsg.trim();
    if (!val) return;

    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSmsInboxLogs((prev) => [
      {
        id: `in_msg_${Date.now()}`,
        phone: sub.phone,
        message: val,
        timestamp: timestampStr,
        inbound: true
      },
      ...prev
    ]);

    if (val.toUpperCase() === "X") {
      setSmsSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
      
      setTimeout(() => {
        setSmsInboxLogs((prev) => [
          {
            id: `reply_unsub_${Date.now()}`,
            phone: sub.phone,
            message: "GreenHarvest Alert: SMS subscription cancel command 'X' recognized. Alerts cleared. Thank you.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            inbound: false
          },
          ...prev
        ]);
        addTickerAlert(`SMS CANCEL: Cleared subscriber ${sub.phone} via text command "X"`);
      }, 600);
    } else {
      setTimeout(() => {
        setSmsInboxLogs((prev) => [
          {
            id: `reply_err_${Date.now()}`,
            phone: sub.phone,
            message: "GreenHarvest Automated Help: Unknown command. Send 'X' to stop all matching alerts immediately.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            inbound: false
          },
          ...prev
        ]);
      }, 600);
    }
    setTestReplyMsg("");
  };

  const calculateTelemetryTotals = () => {
    return nodes.reduce(
      (acc, node) => ({
        water: acc.water + node.supplies.water,
        food: acc.food + node.supplies.food,
        medical: acc.medical + node.supplies.medical,
        shelter: acc.shelter + node.supplies.shelter
      }),
      { water: 0, food: 0, medical: 0, shelter: 0 }
    );
  };

  const totals = calculateTelemetryTotals();

  // Highlight and focus a specific node card on clicks
  const handleNodeClick = (node: DonationNode) => {
    setFocusedNodeId(node.id);
    setMapCenter([node.lat, node.lng]);
    setMapZoom(15);
    addTickerAlert(`Focused target node locator stream: [${node.title.toUpperCase()}]`);
  };

  // Process a new submitted beacon alert from the modal form
  const handleNewAlert = (data: {
    title: string;
    address: string;
    city: string;
    zip: string;
    supplies: { water: number; food: number; medical: number; shelter: number };
    lat: number;
    lng: number;
  }) => {
    const newNode: DonationNode = {
      id: `beacon_custom_${Date.now()}`,
      title: data.title,
      address: data.address,
      city: data.city,
      zip: data.zip,
      lat: data.lat,
      lng: data.lng,
      supplies: data.supplies,
      timestamp: new Date().toISOString()
    };

    setNodes((prev) => [newNode, ...prev]);
    addTickerAlert(`EMERGENCY ALERT BROADCASTED: Beacon created [ZIP: ${data.zip}] - Inventory synced.`);

    // Real-Time Cellular Broadcast Distance Matching
    const listString = Object.entries(data.supplies)
      .filter(([_, qty]) => qty > 0)
      .map(([key, qty]) => `${qty}x ${key.toUpperCase()}`)
      .join(", ");

    smsSubscriptions.forEach((sub) => {
      if (sub.isActive) {
        const dist = getHaversineDistance(data.lat, data.lng, sub.lat, sub.lng);
        if (dist <= sub.radius) {
          const smsMsg = `Green Harvest Alert: New supply [${listString || "RESOURCE PACK"}] posted at "${data.title}" (${dist.toFixed(1)} miles from your base). Reply "X" to cancel alerts.`;
          
          setSmsInboxLogs((prev) => [
            {
              id: `sms_dispatch_${Date.now()}_${Math.random()}`,
              phone: sub.phone,
              message: smsMsg,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              inbound: false
            },
            ...prev
          ]);
          addTickerAlert(`SMS BEACON: Dispatched to ${sub.phone} within ${sub.radius}mi range.`);
        }
      }
    });
    
    // Switch to active tab to display the new marker
    setActiveTab("find");
    // Fly to coordinates
    setTimeout(() => {
      setMapCenter([data.lat, data.lng]);
      setMapZoom(15.5);
      setFocusedNodeId(newNode.id);
    }, 400);

    // Play synth audio notifications inside browser if supported
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const playTone = (freq: number, delay: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + delay);
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + delay);
          osc.stop(now + delay + dur);
        };
        playTone(523.25, 0, 0.3); // C5
        playTone(659.25, 0.1, 0.3); // E5
        playTone(783.99, 0.2, 0.4); // G5
        playTone(1046.50, 0.3, 0.5); // C6
      }
    } catch (e) {}
  };

  // Filter lists based on category chips and search field
  const filteredNodes = nodes.filter((node) => {
    // Category check
    if (selectedCategory !== "all" && node.supplies[selectedCategory] === 0) {
      return false;
    }
    // Search zone check
    if (searchedZone) {
      const query = searchedZone.toLowerCase();
      const matchesZip = node.zip.includes(query);
      const matchesCity = node.city.toLowerCase().includes(query);
      if (!matchesZip && !matchesCity) return false;
    }
    return true;
  });

  const toggleTheme = () => {
    if (themeMode === "dark") {
      setThemeMode("light");
      document.documentElement.setAttribute("data-theme", "light");
      addTickerAlert("System layout inverted: Light display mode.");
    } else {
      setThemeMode("dark");
      document.documentElement.removeAttribute("data-theme");
      addTickerAlert("System layout inverted: Dark twilight mode.");
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      themeMode === "dark" ? "bg-[#1C1E18] text-[#E8E4D9]" : "bg-[#FDFCF8] text-[#3D4035]"
    }`}>
      {/* Visual Ambient Blur Accents matching Natural Tones */}
      <div className="absolute top-[-10%] right-[10%] w-[45vw] h-[45vw] rounded-full bg-natural-primary/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[10%] w-[45vw] h-[45vw] rounded-full bg-natural-secondary/5 blur-[120px] pointer-events-none z-0" />

      {/* Main Grid Workspace */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col gap-5 min-h-screen">
        
        {/* TOP HEADER - Styled in beautiful warm natural tones */}
        <header className="rounded-2xl bg-[#EBEFE6] text-[#2E483A] p-4 md:p-5 border border-[#CBD5C0]/85 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-sm">
          {/* Brand & Mission Statement Quote */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#2E483A]/10 text-[#2E483A] border border-[#2E483A]/15 shadow-sm">
              <Leaf size={18} className="fill-[#2E483A]/10 text-[#2E483A]" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="font-sans font-black text-xl tracking-tight text-[#2E483A] leading-none">
                  GreenHarvest
                </h1>
                <span className="text-[9px] font-mono tracking-widest text-emerald-800 bg-[#2E483A]/10 px-1.5 py-0.5 rounded uppercase font-bold leading-none">
                  SURPLUS INTO SHARING
                </span>
              </div>
              <p className="text-[11px] text-[#4A5E4E] mt-1 font-sans">Empowering local communities with immediate peer-to-peer supply mapping.</p>
            </div>
          </div>

          {/* Navigation Tab selection list + Oval capsule Button */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            <button
              onClick={() => setActiveTab("home")}
              className={`py-1.5 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                activeTab === "home"
                  ? "bg-[#2E483A] text-white shadow-sm font-bold"
                  : "text-[#4A5E4E] hover:text-[#2E483A] hover:bg-[#2E483A]/5"
              }`}
            >
              <Info size={13} className={activeTab === "home" ? "text-white" : "text-[#2E483A]"} />
              <span>Our Mission</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("find")}
              }
              className={`py-1.5 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                activeTab === "find"
                  ? "bg-[#2E483A] text-white shadow-sm font-bold"
                  : "text-[#4A5E4E] hover:text-[#2E483A] hover:bg-[#2E483A]/5"
              }`}
            >
              <Compass size={13} className={activeTab === "find" ? "text-white" : "text-[#2E483A]"} />
              <span>Community Map</span>
            </button>

            <button
              onClick={() => setActiveTab("receive-alerts")}
              className={`py-1.5 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                activeTab === "receive-alerts"
                  ? "bg-[#2E483A] text-white shadow-sm font-bold"
                  : "text-[#4A5E4E] hover:text-[#2E483A] hover:bg-[#2E483A]/5"
              }`}
            >
              <Bell size={13} className={activeTab === "receive-alerts" ? "text-white" : "text-[#2E483A]"} />
              <span>Receive Alerts</span>
            </button>

            <div className="w-px h-6 bg-[#CBD5C0] mx-1 hidden sm:block" />

            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="py-1.5 px-4 rounded-full border border-emerald-700/35 bg-[#2E483A] hover:bg-[#223622] text-white text-xs font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={13} />
              <span>Share Surplus</span>
            </button>
          </div>

          {/* Settings panel - No Clock */}
          <div className="flex items-center gap-2 self-end lg:self-auto shrink-0 font-sans">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full border border-[#CBD5C0] bg-white text-[#2E483A] hover:bg-[#CBD5C0]/10 transition-all cursor-pointer shadow-sm"
              title="Toggle Layout theme"
            >
              {themeMode === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </header>

        {/* Removed Ticker */}

        {/* DOUBLE VIEWPORT: MAP & OPERATIONS SIDEBAR OR FULL-WIDTH MISSION PAGE */}
        {activeTab === "home" ? (
          <div className="flex-1 max-w-4xl mx-auto w-full py-4 space-y-6">
            <div className="bg-white dark:bg-[#252820] border border-[#CBD5C0]/40 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div>
                <span className="text-xs font-mono tracking-widest text-[#5B705B] font-bold uppercase rounded-full bg-[#5B705B]/10 px-3 py-1 border border-[#5B705B]/25">
                  Our Mission & Local Situation
                </span>
                <h2 className="text-xl md:text-2xl font-sans font-black text-[#2E483A] dark:text-[#FEFAE0] mt-4 uppercase tracking-wide leading-snug">
                  Tackling Supply Desertification & Infrastructure Collapses
                </h2>
                <p className="text-[#4A5E4E] dark:text-[#A5A295] leading-relaxed text-sm mt-3 text-justify">
                  During severe disruption windows—triggered by extreme climate shifts, utility grid disruptions, or economic inequalities—supply accessibility deteriorates asymmetrically. High-density areas might receive commercial support, but isolated or vulnerable pockets fall into immediate resource deserts, struggling to secure fresh sustenance, clean water, or safety items.
                </p>
              </div>

              {/* Bento grid of challenges addressed */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-5 rounded-xl bg-[#F6F8F3] dark:bg-[#1E2019]/45 border border-[#CBD5C0]/50 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-[#2E483A]/10 text-[#2E483A] flex items-center justify-center font-bold text-sm mb-2">
                      1
                    </div>
                    <h4 className="font-bold text-xs text-[#2E483A] dark:text-neutral-200 uppercase tracking-widest">Food Insecurity</h4>
                    <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] leading-relaxed mt-2">
                      Fresh produce and shelf-stable ingredients often sit idle or spoil in local storages and markets when central logistical distribution channels halt. We map these excess stocks before they go to waste.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#F6F8F3] dark:bg-[#1E2019]/45 border border-[#CBD5C0]/50 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-[#2E483A]/10 text-[#2E483A] flex items-center justify-center font-bold text-sm mb-2">
                      2
                    </div>
                    <h4 className="font-bold text-xs text-[#2E483A] dark:text-neutral-200 uppercase tracking-widest">Disaster Relief</h4>
                    <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] leading-relaxed mt-2">
                      Severe storms, power grid failures, and floods require swift, localized assistance. By locating clean drinking water, rescue blankets, and portable power banks, neighbors become the community's first line of rescue.
                    </p>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#F6F8F3] dark:bg-[#1E2019]/45 border border-[#CBD5C0]/50 space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-full bg-[#2E483A]/10 text-[#2E483A] flex items-center justify-center font-bold text-sm mb-2">
                      3
                    </div>
                    <h4 className="font-bold text-xs text-[#2E483A] dark:text-neutral-200 uppercase tracking-widest">Mutual Aid</h4>
                    <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] leading-relaxed mt-2">
                      Eliminating red tape by enabling direct, transparent, peer-to-peer resource transfers. Keep physical inventory accounted for, active, and accessible to neighborhood families, avoiding any waste.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-[#4A5E4E] dark:text-[#A5A295] text-xs">
                <p className="text-justify leading-relaxed">
                  <b>GreenHarvest</b> operates entirely as an open-source decentralized community utility. The app stores resource locations in a local sandbox index, notifying and routing individuals directly through cellular relays. You can lock your reference position below to start discovering and tracking nearby food surplus zones or medical support beacons.
                </p>
              </div>

              {/* Dynamic User Location Controller */}
              <div className="border-t border-[#CBD5C0]/40 pt-6 space-y-4 font-sans">
                <div>
                  <h3 className="text-sm font-bold text-[#2A2D24] dark:text-white flex items-center gap-2">
                    <MapPin size={16} className="text-emerald-600 animate-pulse" />
                    <span>Set Your Local Base Coordinates</span>
                  </h3>
                  <p className="text-xs text-[#7A776E] dark:text-[#A5A295] mt-1">
                    Locking your physical location places a green reference point on the community map to easily estimate distance to any active supply sharing node.
                  </p>
                </div>

                {/* Geolocation actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGPSLocationLock}
                      disabled={userLocStatus === "locking"}
                      className={`w-full py-3 rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                        userLocStatus === "active"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-[#5B705B]/10 hover:bg-[#5B705B]/15 text-[#2E483A] dark:text-emerald-400 border border-[#CBD5C0]"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${userLocStatus === "active" ? "bg-white animate-ping" : "bg-emerald-600 animate-pulse"}`} />
                      <span>
                        {userLocStatus === "idle" && "Share Live GPS Coordinates"}
                        {userLocStatus === "locking" && "Acquiring Coordinates..."}
                        {userLocStatus === "active" && "GPS Base Coordinate Fixed"}
                        {userLocStatus === "error" && "Retry Browser GPS Signal"}
                      </span>
                    </button>

                    {/* Manual text backup */}
                    <form onSubmit={handleStreetLocationLock} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Or enter city/street (e.g., Irvine Blvd)"
                        value={userLocInput}
                        onChange={(e) => setUserLocInput(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#F9F8F4] dark:bg-[#171914] border border-[#CBD5C0] rounded-xl text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F]"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-[#CBD5C0]/20 text-xs font-bold text-[#CBD5C0] tracking-wide transition cursor-pointer"
                      >
                        Pin Base
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-col justify-center">
                    {userLocation ? (
                      <div className="rounded-xl p-4 bg-[#F2F5F0] dark:bg-[#1C1E18]/50 border border-[#CBD5C0]/50 font-sans text-xs flex items-center justify-between shadow-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>COORDINATE LOCK ACQUIRED</span>
                          </div>
                          <p className="font-mono text-[11px] text-[#4A5E4E] dark:text-zinc-400">
                            Lat: {userLocation[0].toFixed(5)} • Lng: {userLocation[1].toFixed(5)}
                          </p>
                        </div>
                        <span className="text-[10px] bg-emerald-600/10 border border-emerald-600/25 text-emerald-800 font-mono px-2.5 py-1 rounded font-bold uppercase shadow-sm">
                          Ready
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-xl p-4 bg-[#FDF9F2] border border-[#E9DCC4] flex items-center gap-3 text-xs text-[#A05E03] font-sans">
                        <Info size={18} className="text-amber-600 shrink-0" />
                        <p>
                          Base coordinates unlocked. Standard baseline (Irvine regional center) will be simulated until a position is configured.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[500px]">
            
            {/* LEFT INTERACTIVE PANEL: operations, details, searches */}
            <div className="lg:col-span-4 flex flex-col gap-4 border border-natural-border dark:border-[#2D3126] bg-white dark:bg-[#252820] p-6 rounded-2xl shadow-sm overflow-hidden h-full">
              
              {activeTab === "find" ? (
                <>
                  <h2 className="text-sm font-bold font-sans text-[#2A2D24] dark:text-[#FEFAE0] flex items-center gap-2">
                    <Search size={15} className="text-[#8FA98F]" />
                    <span>Filter Supply Sectors</span>
                  </h2>

                  {/* Form parameters */}
                  <form onSubmit={handleSearchSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="relative">
                        <label htmlFor="search-zip" className="text-[9px] font-bold text-[#A5A295] uppercase absolute left-3 top-1.5 select-none font-sans">Zip Code</label>
                        <input
                          id="search-zip"
                          type="text"
                          placeholder="e.g. 92618"
                          value={searchZip}
                          onChange={(e) => setSearchZip(e.target.value)}
                          className="w-full pt-5 pb-1.5 px-3 bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 rounded-lg text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition font-mono"
                        />
                      </div>
                      <div className="relative font-sans">
                        <label htmlFor="search-city" className="text-[9px] font-bold text-[#A5A295] uppercase absolute left-3 top-1.5 select-none font-sans">City Name</label>
                        <input
                          id="search-city"
                          type="text"
                          placeholder="e.g. Irvine"
                          value={searchCity}
                          onChange={(e) => setSearchCity(e.target.value)}
                          className="w-full pt-5 pb-1.5 px-3 bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 rounded-lg text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-[#5B705B] text-white hover:bg-[#4a5c4a] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#5B705B]/15"
                    >
                      <Search size={13} />
                      <span>Update Map Sectors</span>
                    </button>
                  </form>

                  {/* Filter Categories Chips */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-[#A5A295] uppercase tracking-widest block font-bold">Material Classes</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(["all", "water", "food", "medical", "shelter"] as CategoryFilter[]).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition flex items-center gap-1 cursor-pointer ${
                            selectedCategory === cat
                              ? "bg-[#FEFAE0] border-[#D4A373] text-[#4A3728] dark:bg-[#D4A373]/20 dark:border-[#D4A373] dark:text-[#FEFAE0]"
                              : "bg-[#F9F8F4] dark:bg-[#171914] border-natural-border dark:border-[#3D4035]/40 text-[#7A776E] dark:text-[#A5A295] hover:text-[#5B705B] dark:hover:text-white"
                          }`}
                        >
                          {cat === "all" ? null : (
                            <span>
                              {cat === "water" && <Droplet size={10} />}
                              {cat === "food" && <Utensils size={10} />}
                              {cat === "medical" && <Activity size={10} />}
                              {cat === "shelter" && <Tent size={10} />}
                            </span>
                          )}
                          <span className="capitalize">{cat === "all" ? "All Supplies" : cat}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Available Supply Node list in Area */}
                  <div className="border-t border-natural-border dark:border-[#3D4035]/30 pt-4 flex-1 flex flex-col min-h-[220px]">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="font-mono text-[#7A776E] dark:text-[#A5A295] uppercase tracking-wide font-bold">Sectors Resolved</span>
                      <span className="font-mono text-[#5B705B] dark:text-[#FEFAE0] bg-[#F1F0E8] dark:bg-[#1E2019] px-2 py-0.5 rounded border border-natural-border dark:border-[#2D3126] font-bold leading-none">
                        {filteredNodes.length} Verified
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1.5">
                      {filteredNodes.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-natural-border dark:border-[#2D3126]/60 rounded-xl bg-[#FDFCF8] dark:bg-[#171914]/30 flex flex-col items-center justify-center gap-2">
                          <AlertTriangle className="text-[#D4A373]" size={24} />
                          <h4 className="text-xs font-semibold text-[#2A2D24] dark:text-white">No matched coordinates</h4>
                          <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] leading-normal max-w-xs mx-auto">
                            No pre-seeded donation nodes fit your ZIP / City parameters in this region. You can register your own beacon and alert.
                          </p>
                        </div>
                      ) : (
                        filteredNodes.map((node) => (
                          <div
                            key={node.id}
                            className={`group p-3.5 rounded-xl border relative transition-all duration-200 cursor-pointer ${
                              focusedNodeId === node.id
                                ? "bg-[#F1F0E8] dark:bg-[#2D3126]/60 border-[#5B705B] dark:border-[#8FA98F] shadow-sm"
                                : "bg-white dark:bg-[#171914]/40 border-natural-border dark:border-[#2D3126] hover:bg-[#F9F8F4] dark:hover:bg-[#1E2019]/40 hover:border-[#8FA98F]"
                            }`}
                            onClick={() => handleNodeClick(node)}
                          >
                            <div className="flex items-start justify-between gap-2.5 mb-1.5">
                              <h3 className="text-xs font-bold font-sans text-[#2A2D24] dark:text-white group-hover:text-[#5B705B] dark:group-hover:text-white transition duration-150">
                                {node.title}
                              </h3>
                              <ChevronRight size={13} className="text-[#A5A295] group-hover:text-[#5B705B] dark:group-hover:text-[#8FA98F] transition transform group-hover:translate-x-0.5" />
                            </div>

                            <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] flex items-center gap-1 mb-3">
                              <MapPin size={11} className="text-[#A5A295]" />
                              <span>{node.address}, {node.city} CA {node.zip}</span>
                            </p>

                            {/* Stocks row */}
                            <div className="flex flex-wrap gap-1 font-mono text-[9px]">
                              {Object.entries(node.supplies).map(([key, value]) => {
                                if (value === 0) return null;
                                const meta = SUPPLY_METADATA[key as keyof typeof SUPPLY_METADATA];
                                return (
                                  <span
                                    key={key}
                                    className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${meta.bg} ${meta.border} ${meta.color}`}
                                  >
                                    <span>{value}</span> {meta.label.split(" ")[0]}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4 flex-1 flex flex-col justify-start">
                    {/* Receive Alerts Tab Header */}
                    <div>
                      <span className="text-[9px] font-mono tracking-widest text-[#8FA98F] font-bold uppercase rounded-md bg-[#8FA98F]/5 border border-[#8FA98F]/20 px-2.5 py-1">
                        Resource Alert Network
                      </span>
                      <h2 className="text-sm font-bold font-sans text-[#2A2D24] dark:text-[#FEFAE0] mt-3 uppercase tracking-wide flex items-center gap-1.5">
                        <Bell size={15} className="text-emerald-500" />
                        <span>Receive Live Alerts</span>
                      </h2>
                      <p className="text-[11px] text-[#7A776E] dark:text-[#A5A295] leading-relaxed mt-1.5 text-justify">
                        Register your mobile line below to be automatically updated via text whenever matching physical assets are mapped within your radial boundary.
                      </p>
                    </div>

                    {/* Geolocation visual reference check */}
                    <div className="p-3 rounded-xl bg-[#F9F8F4] dark:bg-[#1E2019]/45 border border-natural-border dark:border-[#2D3126] font-sans text-xs space-y-2">
                      <h3 className="font-bold text-[#3D4035] dark:text-zinc-200 flex items-center gap-1">
                        <MapPin size={13} className="text-emerald-500 animate-pulse" />
                        <span>Alert Base Station Coordinates</span>
                      </h3>
                      {userLocation ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 p-1 bg-emerald-500/10 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] rounded border border-emerald-500/20 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1"></span>
                            <span>STATION FIXED AT GREEN DOT</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            Coords: [{userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}]
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 p-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[9px] rounded border border-amber-500/20 font-bold">
                            <span>🚨 BASE STATION UNLOCKED (Default center used)</span>
                          </div>
                          <p className="text-[10px] text-zinc-500">
                            Please unlock coordinate permission inside the "Our Mission" tab for pin accuracy!
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Subscription entry form */}
                    <form onSubmit={handleSMSSubscription} className="space-y-3 pt-1 font-sans">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-[#A5A295] uppercase block font-bold">Mobile Line (SMS)</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3.5 top-3 text-zinc-400" />
                          <input
                            type="tel"
                            required
                            placeholder="e.g. (949) 219-4820"
                            value={subsPhone}
                            onChange={(e) => setSubsPhone(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-[#F9F8F4] dark:bg-[#171914] border border-natural-border dark:border-[#3D4035]/50 rounded-lg text-xs text-[#2A2D24] dark:text-white outline-none focus:ring-1 focus:ring-[#8FA98F] transition"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono font-bold">
                          <span className="text-[#A5A295] uppercase">Radius Threshold</span>
                          <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">{subsRadius.toFixed(1)} miles</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="15"
                          step="0.5"
                          value={subsRadius}
                          onChange={(e) => setSubsRadius(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[9px] text-[#A5A295] text-right block italic font-sans font-medium">Adjust radius to view expanding perimeter circle on map</span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-lg bg-[#2E483A] text-white hover:bg-[#223622] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/15 font-sans"
                      >
                        <Bell size={13} />
                        <span>Activate SMS Alerts</span>
                      </button>
                    </form>

                    {/* List of Registered Subscribers */}
                    <div className="border-[#CBD5C0]/40 pt-3 flex flex-col border-t">
                      <span className="text-[10px] font-mono text-[#A5A295] uppercase tracking-widest block font-bold mb-2">Registered Cell Feeds</span>
                      
                      <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[220px] pr-1">
                        {smsSubscriptions.length === 0 ? (
                          <p className="text-[10px] text-zinc-500 italic text-center py-2 font-sans">No cell feeds currently in broadcast database.</p>
                        ) : (
                          smsSubscriptions.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-2 border border-natural-border dark:border-[#3D4035]/40 rounded-lg flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/10 text-[11px]"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold text-zinc-700 dark:text-zinc-200">{sub.phone}</span>
                                <span className="text-[9px] text-zinc-500 font-mono">Radius: {sub.radius}mi • Coords: [{sub.lat.toFixed(2)}, {sub.lng.toFixed(2)}]</span>
                              </div>
                              <button
                                onClick={() => removeSubscription(sub.id, sub.phone)}
                                className="p-1 hover:bg-rose-500/15 rounded text-zinc-400 hover:text-rose-500 transition cursor-pointer"
                                title="Delete registration"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </>
              )}

              {/* Quick manual / info banner at the foot */}
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-natural-border dark:border-[#2D3126] bg-[#F1F0E8]/40 dark:bg-[#1E2019]/40 text-[10px] text-[#7A776E] dark:text-[#A5A295] leading-relaxed mt-auto font-sans">
                <Info size={14} className="text-[#8FA98F] shrink-0" />
                <p>
                  Double click on our interactive grid coordinates to focus resolution. Coordinates are retrieved anonymously through client storage pools.
                </p>
              </div>

            </div>

            {/* RIGHT VIEWPORT PANEL: Interactive Leaflet Map container */}
            <div className="lg:col-span-8 flex flex-col rounded-2xl overflow-hidden shadow-sm border border-natural-border dark:border-[#2D3126] h-full min-h-[460px]">
              <MapContainer
                nodes={filteredNodes}
                focusedNodeId={focusedNodeId}
                onNodeSelect={(node) => setFocusedNodeId(node.id)}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                highlightedCoords={highlightedCoords}
                userLocation={userLocation}
                alertCenter={activeTab === "receive-alerts" ? (userLocation || [33.6846, -117.8265]) : null}
                alertRadius={activeTab === "receive-alerts" ? subsRadius : null}
              />
            </div>

          </main>
        )}

        {/* COMPREHENSIVE PLATFORM FOOTER */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-natural-border dark:border-[#2D3126] pt-4 pb-2 text-[10px] text-[#7A776E] dark:text-[#A5A295] font-mono">
          <p>© 2026 GREENHARVEST. DECENTRALIZED RESOURCE LEDGER.</p>
          <div className="flex gap-4 font-bold">
            <a href="#help" className="hover:text-[#5B705B] dark:hover:text-white flex items-center gap-1 transition">Terms & Safety <ExternalLink size={10} /></a>
            <a href="#privacy" className="hover:text-[#5B705B] dark:hover:text-white flex items-center gap-1 transition">Node Status: Optimal <ExternalLink size={10} /></a>
          </div>
        </footer>

      </div>

      {/* ALERT CREATION WIZARD MODAL */}
      <SendAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        onSubmit={handleNewAlert}
      />
    </div>
  );
}
