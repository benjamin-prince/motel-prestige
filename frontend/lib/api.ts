import { getToken, removeToken } from "./auth";
import type { FolioCharge, FolioChargeCreate } from "./types";

// API base: explicit override first. Otherwise, when served on port 3000
// (dev / LAN docker without a proxy) the backend is on the same host at
// port 8000; anywhere else (VPS behind a reverse proxy, single domain over
// HTTPS) the API is same-origin under /api.
const BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined"
    ? (window.location.port === "3000"
        ? `${window.location.protocol}//${window.location.hostname}:8000/api`
        : "/api")
    : "http://localhost:8000/api");

// FastAPI 422 errors return detail as an array of {loc, msg} objects —
// flatten them into a readable message instead of "[object Object]".
function errorMessage(err: any): string {
  if (typeof err?.detail === "string") return err.detail;
  if (Array.isArray(err?.detail)) {
    return err.detail
      .map((d: any) => (d?.loc ? `${d.loc[d.loc.length - 1]}: ${d.msg}` : d?.msg || JSON.stringify(d)))
      .join(" · ");
  }
  return "Request failed";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (res.status === 401) {
    removeToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorMessage(err));
  }
  return res.json();
}

// Unauthenticated request — used only for login
async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorMessage(err));
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    publicRequest<{ access_token: string; token_type: string; user: any }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<any>("/auth/me"),
  getHealth: () => request<{ status: string; database: string; read_only?: boolean }>("/health"),
  changeOwnPassword: (password: string) =>
    request<{ ok: boolean }>("/auth/me/change-password", { method: "POST", body: JSON.stringify({ password }) }),
  getUsers: () => request<any[]>("/auth/users"),
  // Minimal active-staff directory (id, full_name, role) — any signed-in user
  getUsersBasic: () => request<{ id: number; full_name: string; role: string }[]>("/auth/users/basic"),
  createUser: (data: any) => request<any>("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => request<any>(`/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteUser: (id: number) => request<void>(`/auth/users/${id}`, { method: "DELETE" }),

  // Rooms
  getRooms: (params?: string) => request<any[]>(`/rooms/${params ? `?${params}` : ""}`),
  getAvailableRooms: (checkIn: string, checkOut: string, startsAt?: string, endsAt?: string) => {
    const p = new URLSearchParams({ check_in: checkIn, check_out: checkOut });
    if (startsAt) p.set("starts_at", startsAt);
    if (endsAt) p.set("ends_at", endsAt);
    return request<any[]>(`/rooms/available?${p.toString()}`);
  },
  createRoom: (data: any) => request<any>("/rooms/", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id: number, data: any) => request<any>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRoom: (id: number) => request<void>(`/rooms/${id}`, { method: "DELETE" }),

  // Guests
  getGuests: (search?: string) => request<any[]>(`/guests/${search ? `?search=${search}` : ""}`),
  createGuest: (data: any) => request<any>("/guests/", { method: "POST", body: JSON.stringify(data) }),
  updateGuest: (id: number, data: any) => request<any>(`/guests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getGuestProfile: (id: number) => request<any>(`/guests/${id}/profile`),
  deleteGuest: (id: number) => request<void>(`/guests/${id}`, { method: "DELETE" }),

  // Reservations
  getReservations: (params?: string) => request<any[]>(`/reservations/${params ? `?${params}` : ""}`),
  getReservation: (id: number) => request<any>(`/reservations/${id}`),
  createReservation: (data: any) => request<any>("/reservations/", { method: "POST", body: JSON.stringify(data) }),
  updateReservation: (id: number, data: any) => request<any>(`/reservations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  checkIn: (id: number) => request<any>(`/reservations/${id}/check-in`, { method: "POST" }),
  checkOut: (id: number) => request<any>(`/reservations/${id}/check-out`, { method: "POST" }),

  // Key Cards
  getCards: (params?: string) => request<any[]>(`/keycards/${params ? `?${params}` : ""}`),
  getOperationalCards: () => request<any[]>("/keycards/"),
  getGuestCards: (reservationId: number) => request<any[]>(`/keycards/?reservation_id=${reservationId}`),
  issueCard: (data: any) => request<any>("/keycards/issue", { method: "POST", body: JSON.stringify(data) }),
  issueOperationalCard: (data: any) => request<any>("/keycards/issue-operational", { method: "POST", body: JSON.stringify(data) }),
  revokeCard: (id: number) => request<any>(`/keycards/${id}/revoke`, { method: "POST" }),
  reportLost: (id: number) => request<any>(`/keycards/${id}/report-lost`, { method: "POST" }),
  extendCard: (id: number, expires_at: string) => request<any>(`/keycards/${id}/extend`, { method: "POST", body: JSON.stringify({ expires_at }) }),
  simulateAccess: (id: number, door: string) => request<any>(`/keycards/${id}/simulate-access?door_location=${encodeURIComponent(door)}`, { method: "POST" }),
  // Check-in flow: (re)activate the room's permanent card for a reservation's stay
  activateRoomCard: (reservationId: number) =>
    request<any>("/keycards/activate-room-card", { method: "POST", body: JSON.stringify({ reservation_id: reservationId }) }),
  getCardLogs: (id: number) => request<any[]>(`/keycards/${id}/logs`),

  // Billing
  getAllCharges: (from?: string, to?: string) =>
    request<FolioCharge[]>(`/billing/folio-charges?${from ? `date_from=${from}&` : ""}${to ? `date_to=${to}` : ""}`),
  getFolio: (reservationId: number) => request<FolioCharge[]>(`/billing/folio/${reservationId}`),
  getFolioSummary: (reservationId: number) => request<any>(`/billing/folio/${reservationId}/summary`),
  addCharge: (data: FolioChargeCreate) => request<FolioCharge>("/billing/folio/charge", { method: "POST", body: JSON.stringify(data) }),
  voidCharge: (id: number) => request<any>(`/billing/folio/charge/${id}/void`, { method: "POST" }),
  settleFolio: (data: any) => request<any>("/billing/folio/settle", { method: "POST", body: JSON.stringify(data) }),
  getInvoices: (reservationId?: number) => request<any[]>(`/billing/invoices/${reservationId ? `?reservation_id=${reservationId}` : ""}`),
  createInvoice: (data: any) => request<any>("/billing/invoices/", { method: "POST", body: JSON.stringify(data) }),

  // Housekeeping
  getHKRooms: (params?: string) => request<any[]>(`/housekeeping/rooms${params ? `?${params}` : ""}`),
  updateHKRoomStatus: (id: number, hk_status: string) => request<any>(`/housekeeping/rooms/${id}/hk-status`, { method: "PATCH", body: JSON.stringify({ hk_status }) }),
  getHKTasks: (params?: string) => request<any[]>(`/housekeeping/tasks${params ? `?${params}` : ""}`),
  createHKTask: (data: any) => request<any>("/housekeeping/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateHKTask: (id: number, data: any) => request<any>(`/housekeeping/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteHKTask: (id: number) => request<void>(`/housekeeping/tasks/${id}`, { method: "DELETE" }),
  getLostFound: (status?: string) => request<any[]>(`/housekeeping/lost-found${status ? `?status=${status}` : ""}`),
  createLostFound: (data: any) => request<any>("/housekeeping/lost-found", { method: "POST", body: JSON.stringify(data) }),
  updateLostFound: (id: number, data: any) => request<any>(`/housekeeping/lost-found/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLostFound: (id: number) => request<void>(`/housekeeping/lost-found/${id}`, { method: "DELETE" }),

  // Maintenance
  getMaintenanceRequests: (params?: string) => request<any[]>(`/maintenance/${params ? `?${params}` : ""}`),
  createMaintenanceRequest: (data: any) => request<any>("/maintenance/", { method: "POST", body: JSON.stringify(data) }),
  updateMaintenanceRequest: (id: number, data: any) => request<any>(`/maintenance/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMaintenanceRequest: (id: number) => request<void>(`/maintenance/${id}`, { method: "DELETE" }),

  // Inventory / Store
  getStoreItems: (includeInactive = false) => request<any[]>(`/inventory/items${includeInactive ? "?include_inactive=true" : ""}`),
  createStoreItem: (data: any) => request<any>("/inventory/items", { method: "POST", body: JSON.stringify(data) }),
  updateStoreItem: (id: number, data: any) => request<any>(`/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adjustStock: (id: number, data: any) => request<any>(`/inventory/items/${id}/adjust`, { method: "POST", body: JSON.stringify(data) }),
  getStockMovements: (itemId?: number, limit = 100) => request<any[]>(`/inventory/movements?limit=${limit}${itemId ? `&item_id=${itemId}` : ""}`),
  getRequisitions: (status?: string) => request<any[]>(`/inventory/requisitions${status ? `?status=${status}` : ""}`),
  createRequisition: (data: any) => request<any>("/inventory/requisitions", { method: "POST", body: JSON.stringify(data) }),
  approveRequisition: (id: number, note?: string) => request<any>(`/inventory/requisitions/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  rejectRequisition: (id: number, note?: string) => request<any>(`/inventory/requisitions/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),

  // Dashboard analytics
  getDashboardOverview: (days = 7) => request<any>(`/dashboard/overview?days=${days}`),

  // Night Audit
  getPendingCheckouts: () => request<any[]>("/billing/night-audit/pending-checkouts"),
  postNightlyCharges: () => request<any>("/billing/night-audit/post-room-charges", { method: "POST" }),

  // Currencies
  getCurrencies: (activeOnly = false) => request<any[]>(`/currencies/${activeOnly ? "?active_only=true" : ""}`),
  createCurrency: (data: any) => request<any>("/currencies/", { method: "POST", body: JSON.stringify(data) }),
  updateCurrency: (code: string, data: any) => request<any>(`/currencies/${code}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCurrency: (code: string) => request<void>(`/currencies/${code}`, { method: "DELETE" }),
  convertFromXaf: (amount_xaf: number, target: string) => request<any>("/currencies/convert", { method: "POST", body: JSON.stringify({ amount_xaf, target_currency: target }) }),

  // Payments
  getPayments: (reservationId?: number) => request<any[]>(`/currencies/payments/list${reservationId ? `?reservation_id=${reservationId}` : ""}`),
  createPayment: (data: any) => request<any>("/currencies/payments", { method: "POST", body: JSON.stringify(data) }),

  // Caisse
  getCaisse: () => request<any>("/currencies/caisse/summary"),

  // Config / Seed data
  getMenuItems: (opts?: { main_category?: string; category?: string; subcategory?: string }) => {
    const params = new URLSearchParams();
    if (opts?.main_category) params.set("main_category", opts.main_category);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.subcategory) params.set("subcategory", opts.subcategory);
    const qs = params.toString();
    return request<any[]>(`/config/menu-items${qs ? `?${qs}` : ""}`);
  },
  getMenuMainCategories: () => request<{ value_en: string; value_fr: string }[]>("/config/menu-main-categories"),
  getMenuCategories: (parent?: string) => request<{ value_en: string; value_fr: string; parent_value_en?: string }[]>(`/config/menu-categories${parent ? `?parent=${encodeURIComponent(parent)}` : ""}`),
  getMenuSubcategories: (parent?: string) => request<{ value_en: string; value_fr: string; parent_value_en: string }[]>(`/config/menu-subcategories${parent ? `?parent=${encodeURIComponent(parent)}` : ""}`),
  createMenuItem: (data: any) => request<any>("/config/menu-items", { method: "POST", body: JSON.stringify(data) }),
  updateMenuItem: (id: number, data: any) => request<any>(`/config/menu-items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  // F&B Orders (POS)
  getFnbOrders: (params?: { status?: string; outlet?: string; date_from?: string; date_to?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v) as [string, string][]
    ).toString();
    return request<any[]>(`/fnb/orders${qs ? `?${qs}` : ""}`);
  },
  createFnbOrder: (data: any) => request<any>("/fnb/orders", { method: "POST", body: JSON.stringify(data) }),
  updateFnbOrder: (id: number, data: any) => request<any>(`/fnb/orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  chargeFnbToRoom: (id: number, reservationId: number) =>
    request<any>(`/fnb/orders/${id}/charge-to-room`, { method: "POST", body: JSON.stringify({ reservation_id: reservationId }) }),
  settleFnbOrder: (id: number, paymentMethod: string) =>
    request<any>(`/fnb/orders/${id}/settle`, { method: "POST", body: JSON.stringify({ payment_method: paymentMethod }) }),
  cancelFnbOrder: (id: number) => request<void>(`/fnb/orders/${id}`, { method: "DELETE" }),

  // F&B Outlets
  getFnbOutlets: () => request<any[]>("/fnb/outlets"),
  createFnbOutlet: (data: any) => request<any>("/fnb/outlets", { method: "POST", body: JSON.stringify(data) }),
  updateFnbOutlet: (id: number, data: any) => request<any>(`/fnb/outlets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFnbOutlet: (id: number) => request<void>(`/fnb/outlets/${id}`, { method: "DELETE" }),

  // Sales — rate packages
  getPackages: (activeOnly = false) => request<any[]>(`/sales/packages${activeOnly ? "?active_only=true" : ""}`),
  createPackage: (data: any) => request<any>("/sales/packages", { method: "POST", body: JSON.stringify(data) }),
  updatePackage: (id: number, data: any) => request<any>(`/sales/packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePackage: (id: number) => request<void>(`/sales/packages/${id}`, { method: "DELETE" }),

  // Sales — accounts (corporate / agents / OTA)
  getSalesAccounts: (type?: string) => request<any[]>(`/sales/accounts${type ? `?account_type=${type}` : ""}`),
  createSalesAccount: (data: any) => request<any>("/sales/accounts", { method: "POST", body: JSON.stringify(data) }),
  updateSalesAccount: (id: number, data: any) => request<any>(`/sales/accounts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSalesAccount: (id: number) => request<void>(`/sales/accounts/${id}`, { method: "DELETE" }),

  // HR — shifts
  getShifts: (params?: { date_from?: string; date_to?: string; user_id?: number }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString();
    return request<any[]>(`/hr/shifts${qs ? `?${qs}` : ""}`);
  },
  createShift: (data: any) => request<any>("/hr/shifts", { method: "POST", body: JSON.stringify(data) }),
  updateShift: (id: number, data: any) => request<any>(`/hr/shifts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteShift: (id: number) => request<void>(`/hr/shifts/${id}`, { method: "DELETE" }),

  // HR — payroll
  getPayroll: (period?: string) => request<any[]>(`/hr/payroll${period ? `?period=${period}` : ""}`),
  createPayroll: (data: any) => request<any>("/hr/payroll", { method: "POST", body: JSON.stringify(data) }),
  updatePayroll: (id: number, data: any) => request<any>(`/hr/payroll/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePayroll: (id: number) => request<void>(`/hr/payroll/${id}`, { method: "DELETE" }),

  getFolioParticulars: (all = false) => request<any[]>(`/config/folio-particulars${all ? "?all=true" : ""}`),
  createFolioParticular: (data: any) => request<any>("/config/folio-particulars", { method: "POST", body: JSON.stringify(data) }),
  updateFolioParticular: (id: number, data: any) => request<any>(`/config/folio-particulars/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getLookup: (group: string, all = false) => request<any[]>(`/config/lookup/${group}${all ? "?all=true" : ""}`),
  getAllLookups: (all = false) => request<any[]>(`/config/lookup${all ? "?all=true" : ""}`),
  createLookup: (data: any) => request<any>("/config/lookup", { method: "POST", body: JSON.stringify(data) }),
  updateLookup: (id: number, data: any) => request<any>(`/config/lookup/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateRoomType: (id: number, data: any) => request<any>(`/config/room-types/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getSettings: () => request<Record<string, string>>("/config/settings"),
  saveSettings: (data: Record<string, string>) => request<Record<string, string>>("/config/settings", { method: "PUT", body: JSON.stringify(data) }),
  getActivityLog: (opts?: { limit?: number; skip?: number; entity_type?: string; search?: string }) => {
    const p = new URLSearchParams();
    if (opts?.limit !== undefined) p.set("limit", String(opts.limit));
    if (opts?.skip !== undefined) p.set("skip", String(opts.skip));
    if (opts?.entity_type) p.set("entity_type", opts.entity_type);
    if (opts?.search) p.set("search", opts.search);
    const qs = p.toString();
    return request<any[]>(`/config/activity${qs ? `?${qs}` : ""}`);
  },
  getRoomTypes: () => request<any[]>("/config/room-types"),
  getAppInfo: () => publicRequest<{ name: string; logo_url: string }>("/auth/app-info"),
  getProperties: () => request<any[]>("/config/properties"),
  createProperty: (data: any) => request<any>("/config/properties", { method: "POST", body: JSON.stringify(data) }),
  updateProperty: (id: number, data: any) => request<any>(`/config/properties/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProperty: (id: number) => request<void>(`/config/properties/${id}`, { method: "DELETE" }),

  // Roles & Permissions
  getPermissionGroups: () => request<any[]>("/config/permission-groups"),
  getRoles: () => request<any[]>("/config/roles"),
  createRole: (data: { id: string; name_en: string; name_fr: string; color: string; permissions: string[] }) =>
    request<any>("/config/roles", { method: "POST", body: JSON.stringify(data) }),
  updateRole: (id: string, data: { name_en?: string; name_fr?: string; color?: string; permissions?: string[] }) =>
    request<any>(`/config/roles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRole: (id: string) => request<void>(`/config/roles/${id}`, { method: "DELETE" }),
};
