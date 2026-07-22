"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

export interface Property {
  id: number;
  name: string;
  type: string;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  floor_min?: number;
  floor_max?: number;
  floors?: string | null;
  facilities?: string | null;
}

export interface FacilityEntry {
  code: string;
  floor: number | null;
}

export interface FloorEntry {
  floor: number;
  label: string;
}

/** Parse the floors JSON column ([{floor, label}]). */
export function parseFloors(raw: string | null | undefined): FloorEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((f: any) => f && typeof f.floor === "number")
      .map((f: any) => ({ floor: f.floor, label: String(f.label ?? "") }));
  } catch {
    return [];
  }
}

/** The site's full floor range (floor_min..floor_max) merged with the
 *  labels defined in the building layout — e.g. -1 "Basement", 0 "Ground floor". */
export function getFloors(p: Property | null): FloorEntry[] {
  if (!p) return [];
  const labels = new Map(parseFloors(p.floors).map(f => [f.floor, f.label]));
  const out: FloorEntry[] = [];
  for (let f = p.floor_min ?? 0; f <= (p.floor_max ?? 0) && out.length < 60; f++) {
    out.push({ floor: f, label: labels.get(f) || "" });
  }
  return out;
}

/** Parse the facilities JSON column; accepts both the current
 *  [{code, floor}] shape and the legacy ["code", ...] shape. */
export function parseFacilities(raw: string | null | undefined): FacilityEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((f: any) => (typeof f === "string" ? { code: f, floor: null } : { code: f?.code, floor: f?.floor ?? null }))
      .filter(f => f.code);
  } catch {
    return [];
  }
}

const LODGING_TYPES = ["hotel", "motel", "hostel", "resort", "inn", "guesthouse", "apartment"];
const FNB_TYPES = ["restaurant & bar", "night club"];
const FNB_FACILITIES = ["restaurant", "bar", "nightclub", "room_service"];

export interface SiteCapabilities {
  lodging: boolean; // rooms, reservations, housekeeping, keycards, night audit
  fnb: boolean;     // restaurant / bar / night club
  spa: boolean;
  beauty: boolean;
}

export function getCapabilities(p: Property | null): SiteCapabilities {
  // No site loaded yet (e.g. before login) — don't hide anything.
  if (!p) return { lodging: true, fnb: true, spa: true, beauty: true };
  const codes = parseFacilities(p.facilities).map(f => f.code);
  const has = (...cs: string[]) => cs.some(c => codes.includes(c));
  return {
    lodging: LODGING_TYPES.includes(p.type),
    fnb: FNB_TYPES.includes(p.type) || has(...FNB_FACILITIES),
    spa: p.type === "spa" || has("spa"),
    beauty: p.type === "beauty salon" || has("beauty_salon"),
  };
}

interface PropertyContextValue {
  properties: Property[];
  current: Property | null;
  capabilities: SiteCapabilities;
  setCurrent: (p: Property) => void;
  reload: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextValue>({
  properties: [],
  current: null,
  capabilities: getCapabilities(null),
  setCurrent: () => {},
  reload: async () => {},
});

const STORAGE_KEY = "mp_property_id";

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [current, setCurrentState] = useState<Property | null>(null);

  const load = async () => {
    try {
      const list: Property[] = await api.getProperties();
      setProperties(list);

      const savedId = typeof window !== "undefined"
        ? Number(localStorage.getItem(STORAGE_KEY))
        : 0;
      const saved = list.find(p => p.id === savedId && p.is_active);
      const def = list.find(p => p.is_default) || list[0] || null;
      setCurrentState(saved ?? def);
    } catch {
      // not logged in yet — silently ignore
    }
  };

  useEffect(() => { load(); }, []);

  const setCurrent = (p: Property) => {
    setCurrentState(p);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(p.id));
    }
  };

  return (
    <PropertyContext.Provider value={{ properties, current, capabilities: getCapabilities(current), setCurrent, reload: load }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  return useContext(PropertyContext);
}
