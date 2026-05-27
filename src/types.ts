export interface SupplyQuantities {
  water: number;
  food: number;
  medical: number;
  shelter: number;
}

export interface SMSSubscription {
  id: string;
  phone: string;
  radius: number; // in miles
  lat: number;
  lng: number;
  createdAt: string;
  isActive: boolean;
}

export interface DonationNode {
  id: string;
  title: string;
  address: string;
  city: string;
  zip: string;
  lat: number;
  lng: number;
  supplies: SupplyQuantities;
  timestamp: string;
}

export type CategoryFilter = "all" | "water" | "food" | "medical" | "shelter";

// Helper for display labels and icons
export const SUPPLY_METADATA = {
  water: { label: "Water Bottles", icon: "Droplet", color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-50/80 dark:bg-sky-500/10", border: "border-sky-200/60 dark:border-sky-500/30" },
  food: { label: "Food Packs (MRE)", icon: "Utensils", color: "text-amber-800 dark:text-amber-500", bg: "bg-amber-50/80 dark:bg-amber-500/10", border: "border-amber-200/60 dark:border-amber-500/30" },
  medical: { label: "Medical Kits", icon: "Activity", color: "text-rose-800 dark:text-rose-500", bg: "bg-rose-50/80 dark:bg-rose-500/10", border: "border-rose-200/60 dark:border-rose-500/30" },
  shelter: { label: "Sleeping Gear", icon: "Home", color: "text-emerald-800 dark:text-emerald-400", bg: "bg-emerald-50/80 dark:bg-emerald-500/10", border: "border-emerald-200/60 dark:border-emerald-500/30" },
};

export const INITIAL_NODES: DonationNode[] = [
  {
    id: "node_ucl",
    title: "UCI Campus Relief Depot",
    address: "401 Peltason Dr",
    city: "Irvine",
    zip: "92697",
    lat: 33.6405,
    lng: -117.8443,
    supplies: { water: 150, food: 90, medical: 35, shelter: 20 },
    timestamp: "2026-05-27T01:00:00Z"
  },
  {
    id: "node_spectrum",
    title: "Irvine Spectrum Crisis Care Grid",
    address: "670 Spectrum Center Dr",
    city: "Irvine",
    zip: "92618",
    lat: 33.6512,
    lng: -117.7471,
    supplies: { water: 300, food: 200, medical: 80, shelter: 45 },
    timestamp: "2026-05-27T01:10:00Z"
  },
  {
    id: "node_woodbury",
    title: "Woodbury Community Supply Node",
    address: "6200 Irvine Blvd",
    city: "Irvine",
    zip: "92620",
    lat: 33.6934,
    lng: -117.7656,
    supplies: { water: 80, food: 110, medical: 15, shelter: 30 },
    timestamp: "2026-05-27T01:15:00Z"
  },
  {
    id: "node_westpark",
    title: "Westpark Center Sanctuary Base",
    address: "3801 Alton Pkwy",
    city: "Irvine",
    zip: "92614",
    lat: 33.6826,
    lng: -117.8184,
    supplies: { water: 220, food: 140, medical: 50, shelter: 15 },
    timestamp: "2026-05-27T01:20:00Z"
  },
  {
    id: "node_greatpark",
    title: "Orange County Great Park Hub",
    address: "8000 Great Park Blvd",
    city: "Irvine",
    zip: "92618",
    lat: 33.6762,
    lng: -117.7397,
    supplies: { water: 450, food: 250, medical: 120, shelter: 60 },
    timestamp: "2026-05-27T01:25:00Z"
  }
];
