import React, { useEffect, useRef } from "react";
import { DonationNode } from "../types";

interface MapContainerProps {
  nodes: DonationNode[];
  onNodeSelect?: (node: DonationNode) => void;
  focusedNodeId: string | null;
  mapCenter: [number, number];
  mapZoom: number;
  highlightedCoords: [number, number] | null;
  userLocation: [number, number] | null;
  alertCenter?: [number, number] | null;
  alertRadius?: number | null;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  nodes,
  onNodeSelect,
  focusedNodeId,
  mapCenter,
  mapZoom,
  highlightedCoords,
  userLocation,
  alertCenter,
  alertRadius
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const searchMarkerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const alertCircleRef = useRef<any>(null);

  // 1. Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) {
      console.error("Leaflet is not loaded on window.");
      return;
    }

    // Warm, beautiful light Voyager map schema
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(mapCenter, mapZoom);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
    }).addTo(map);

    // Zoom Controls
    const zoomGroup = L.Control.extend({
      options: { position: "topright" },
      onAdd: () => {
        const container = L.DomUtil.create("div", "leaflet-bar-custom-group flex flex-col gap-1.5 m-4");
        
        const zoomIn = L.DomUtil.create("button", "w-8 h-8 rounded-lg bg-white border border-[#CBD5C0] hover:bg-[#F2F5F0] justify-center items-center flex text-[#2E483A] font-bold shadow-sm", container);
        zoomIn.innerHTML = "+";
        zoomIn.title = "Zoom In";
        L.DomEvent.on(zoomIn, "click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          map.zoomIn();
        });

        const zoomOut = L.DomUtil.create("button", "w-8 h-8 rounded-lg bg-white border border-[#CBD5C0] hover:bg-[#F2F5F0] justify-center items-center flex text-[#2E483A] font-bold shadow-sm", container);
        zoomOut.innerHTML = "-";
        zoomOut.title = "Zoom Out";
        L.DomEvent.on(zoomOut, "click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          map.zoomOut();
        });

        return container;
      }
    });
    map.addControl(new zoomGroup());

    mapRef.current = map;

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Fly to active mapCenter changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo(mapCenter, mapZoom, { duration: 1.2 });
    }
  }, [mapCenter, mapZoom]);

  // 3. Highlighted location pin (e.g. search coordinate or alert preview)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = (window as any).L;
    if (!L) return;

    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = null;
    }

    if (highlightedCoords) {
      const searchPulseHtml = `
        <div class="relative w-10 h-10 flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full border-2 border-dashed border-emerald-600 animate-spin" style="animation-duration: 8s;"></div>
          <div class="w-3 h-3 rounded-full bg-emerald-600 animate-pulse"></div>
        </div>
      `;

      const searchIcon = L.divIcon({
        className: "custom-leaflet-search-pulse",
        html: searchPulseHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      searchMarkerRef.current = L.marker(highlightedCoords, { icon: searchIcon }).addTo(map);
    }
  }, [highlightedCoords]);

  // 4. Update Node Markers on node values update
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear previous markers
    Object.values(markersRef.current).forEach((marker: any) => {
      map.removeLayer(marker);
    });
    markersRef.current = {};

    // Render active node list
    nodes.forEach((node) => {
      const pulseHtml = `
        <div class="marker-pulse-wrapper">
          <div class="marker-blue-core"></div>
          <div class="marker-pulse-ring"></div>
          <div class="marker-pulse-ring-2"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-leaflet-marker-pulse",
        html: pulseHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const popupHtml = `
        <div class="p-2 min-w-[200px] text-zinc-800">
          <h4 class="font-bold text-[#2E483A] text-sm mb-1">${node.title}</h4>
          <p class="text-xs text-zinc-600 mb-2.5 flex items-center gap-1 font-sans">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-zinc-400"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            ${node.address}, ${node.city}
          </p>
          <div class="grid grid-cols-2 gap-1 text-[11px] font-sans">
            ${node.supplies.water > 0 ? `<div class="bg-blue-50 border border-blue-200 text-blue-800 rounded px-1.5 py-0.5 font-bold"><span>Water:</span> <b>${node.supplies.water}</b></div>` : ""}
            ${node.supplies.food > 0 ? `<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded px-1.5 py-0.5 font-bold"><span>Food:</span> <b>${node.supplies.food}</b></div>` : ""}
            ${node.supplies.medical > 0 ? `<div class="bg-rose-50 border border-rose-200 text-rose-800 rounded px-1.5 py-0.5 font-bold"><span>Med:</span> <b>${node.supplies.medical}</b></div>` : ""}
            ${node.supplies.shelter > 0 ? `<div class="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded px-1.5 py-0.5 font-bold"><span>Gear:</span> <b>${node.supplies.shelter}</b></div>` : ""}
          </div>
        </div>
      `;

      const marker = L.marker([node.lat, node.lng], { icon: customIcon })
        .bindPopup(popupHtml)
        .addTo(map);

      // Trigger selection state representation on click
      marker.on("click", () => {
        if (onNodeSelect) {
          onNodeSelect(node);
        }
      });

      markersRef.current[node.id] = marker;
    });
  }, [nodes]);

  // 5. Trigger focused node popup opening
  useEffect(() => {
    if (focusedNodeId && markersRef.current[focusedNodeId]) {
      const marker = markersRef.current[focusedNodeId];
      setTimeout(() => {
        marker.openPopup();
      }, 300);
    }
  }, [focusedNodeId]);

  // 6. User Location marker (The Green Dot)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = (window as any).L;
    if (!L) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const greenPulseHtml = `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-emerald-500/30 animate-ping" style="animation-duration: 2.2s;"></div>
          <div class="absolute w-4.5 h-4.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1E2019] shadow flex items-center justify-center">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `;

      const greenIcon = L.divIcon({
        className: "custom-leaflet-user-pulse",
        html: greenPulseHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div class="p-2 text-zinc-800 font-sans min-w-[150px]">
          <h4 class="font-bold text-emerald-700 text-xs flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Your Base Coordinate
          </h4>
          <p class="text-[10px] text-zinc-600 mt-1 leading-normal font-sans">
            Latitude: <span class="font-mono text-[#2E483A] font-semibold">${userLocation[0].toFixed(5)}</span><br/>
            Longitude: <span class="font-mono text-[#2E483A] font-semibold">${userLocation[1].toFixed(5)}</span>
          </p>
        </div>
      `;

      userMarkerRef.current = L.marker(userLocation, { icon: greenIcon })
        .bindPopup(popupHtml)
        .addTo(map);
    }
  }, [userLocation]);

  // 7. SMS Subscription active alert radius circle overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L = (window as any).L;
    if (!L) return;

    if (alertCircleRef.current) {
      map.removeLayer(alertCircleRef.current);
      alertCircleRef.current = null;
    }

    if (alertCenter && alertRadius) {
      // Create a Leaflet circle centered at alertCenter with radius in meters (1 mile = 1609.34 meters)
      alertCircleRef.current = L.circle(alertCenter, {
        color: '#10b981', // emerald-500 matching green dot
        weight: 1.5,
        opacity: 0.65,
        fillColor: '#10b981',
        fillOpacity: 0.08,
        dashArray: "5, 5",
        radius: alertRadius * 1609.34
      }).addTo(map);
    }
  }, [alertCenter, alertRadius]);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-[#CBD5C0]/40 bg-[#F9FBF8] shadow-sm">
      {/* Outer local labels */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-[#CBD5C0]/60 px-3 py-1.5 rounded-lg shadow-sm">
        <span className="w-2 h-2 rounded-full bg-[#5B705B] animate-pulse" />
        <span className="text-[10px] font-sans font-bold tracking-wider text-[#2E483A]/90">ACTIVE MAP ZONE</span>
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] flex gap-3 text-[10px] font-sans font-medium text-zinc-600 bg-white/95 backdrop-blur-sm border border-[#CBD5C0]/40 px-2.5 py-1.5 rounded-lg shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] shadow-sm animate-pulse" /> Supply Node
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Your Base
        </div>
      </div>

      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
};
