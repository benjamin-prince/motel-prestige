export type RoomStatus = "available" | "occupied" | "maintenance" | "cleaning";
export type RoomType = "single" | "double" | "twin" | "suite" | "deluxe";

export interface Room {
  id: number;
  room_number: string;
  room_type: string;
  floor: number;
  status: RoomStatus;
  price_per_night: number;
  price_short_stay?: number | null; // 2h rate
  stay_offer?: string;              // OS = nuitée only, SS = 2h only, BOTH
  max_occupancy: number;
  description?: string;
  amenities?: string[];
  created_at?: string;
}

export interface Guest {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  id_type?: string;
  id_number?: string;
  id_expiry_date?: string;
  nationality?: string;
  country_of_residence?: string;
  date_of_birth?: string;
  address?: string;
  referred_by?: string;
  notes?: string;
  created_at?: string;
}

export interface SpecialInstruction {
  id: number;
  department: string;
  description: string;
}

export interface Reservation {
  id: number;
  reservation_number: string;
  guest_id: number;
  room_id: number;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  extra_bed: number;
  status: string;
  resev_type?: string;
  rate_plan?: string;            // OS = overnight, SS = Short Stay (2h)
  stay_starts_at?: string | null;
  stay_ends_at?: string | null;
  actual_check_in?: string | null;
  actual_check_out?: string | null;
  guest_type?: string;
  arrival_mode?: string;
  arrival_flight?: string;
  bill_to?: string;
  payment_type?: string;
  payment_method?: string;
  advance_amount?: number;
  special_instructions: SpecialInstruction[];
  created_at?: string;
}

export interface KeyCard {
  id: number;
  card_number: string;
  card_uid?: string;
  reservation_id?: number;
  guest_id?: number;
  room_id?: number;
  card_type: string;
  status: string;
  issued_at: string;
  valid_from: string;
  expires_at: string;
  deactivated_at?: string;
  access_count: number;
}

/** Canonical charge classifier — mirrors the backend's charge_type. */
export type ChargeClass = "room" | "extra" | "payment" | "discount" | "tax";

export interface FolioCharge {
  id: number;
  reservation_id: number;
  ref_number: string;
  date: string;
  room_number?: string;
  particular: string;
  charge_type?: string;   // "room" | "extra" | "payment", or a granular subtype (e.g. "outlet")
  description?: string;
  amount: number;
  posted_by?: string;
  is_void: boolean;
  is_posted: boolean;
  created_at?: string;
}

/** Payload for POST /billing/folio/charge — matches backend FolioChargeCreate. */
export interface FolioChargeCreate {
  reservation_id: number;
  date: string;           // YYYY-MM-DD
  particular: string;
  amount: number;
  charge_type?: ChargeClass | (string & {});  // canonical class, or a granular subtype
  room_number?: string;
  description?: string;
  posted_by?: string;
}

export interface FolioSummary {
  room_charges: number;
  discount: number;
  tax: number;
  extra_charge: number;
  unposted_inclusion: number;
  amount_paid: number;
  round_off: number;
  total: number;
}

export interface Currency {
  id: number;
  code: string;          // XAF, USD, EUR, CNY
  name: string;          // Franc CFA BEAC
  symbol: string;        // FCFA, $, €, ¥
  xaf_rate: number;      // 1 unit = xaf_rate XAF
  is_default: boolean;
  is_active: boolean;
  updated_at?: string;
}

export interface Payment {
  id: number;
  reservation_id: number;
  invoice_id?: number;
  amount: number;               // in payment currency
  currency_code: string;
  xaf_equivalent: number;       // converted to XAF
  xaf_rate_snapshot: number;
  payment_method: string;
  reference?: string;
  note?: string;
  paid_at: string;
}

export interface CaisseEntry {
  currency_code: string;
  currency_name: string;
  symbol: string;
  total_amount: number;
  total_xaf: number;
  payment_count: number;
}

export interface CaisseSummary {
  entries: CaisseEntry[];
  grand_total_xaf: number;
}

export interface ConversionResult {
  amount_xaf: number;
  target_currency: string;
  target_amount: number;
  xaf_rate: number;
  symbol: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  reservation_id?: number;
  guest_id?: number;
  status: string;
  room_charges: number;
  discount: number;
  tax: number;
  extra_charge: number;
  amount_paid: number;
  round_off: number;
  total: number;
  payment_type?: string;
  issued_at?: string;
  paid_at?: string;
  created_at?: string;
}
