"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { EmptyState, SkeletonCards } from "@/components/ui";

// ── Board state (visual) per room ─────────────────────────────────────────────
type RState = "occupied" | "departure" | "arrival" | "available" | "hs";
const STATE_META: Record<RState, { fr: string; en: string; color: string; bg: string; ring: string }> = {
  occupied:  { fr: "Occupé",   en: "Occupied",  color: "#2563eb", bg: "#eff6ff", ring: "#bfdbfe" },
  departure: { fr: "Départs",  en: "Departure", color: "#dc2626", bg: "#fef2f2", ring: "#fecaca" },
  arrival:   { fr: "Arrivée",  en: "Arrival",   color: "#7c3aed", bg: "#f5f3ff", ring: "#ddd6fe" },
  available: { fr: "Libre",    en: "Free",      color: "#16a34a", bg: "#f0fdf4", ring: "#bbf7d0" },
  hs:        { fr: "H.S.",     en: "Out",       color: "#64748b", bg: "#f8fafc", ring: "#e2e8f0" },
};

// Quick-status values used by the detail modal (= room.status enum)
const QUICK_STATUS: Record<string, { color: string; bg: string; border: string; fr: string; en: string }> = {
  available:   { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", fr: "Disponible",  en: "Available" },
  occupied:    { color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", fr: "Occupée",     en: "Occupied" },
  cleaning:    { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", fr: "En Nettoyage", en: "Cleaning" },
  maintenance: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", fr: "Maintenance", en: "Maintenance" },
};
const QUICK_ORDER = ["available", "occupied", "cleaning", "maintenance"] as const;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const isSameDay = (dateStr?: string) => !!dateStr && String(dateStr).slice(0, 10) === todayStr();
function daysUntil(dateStr: string) { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000); }
function daysAgo(dateStr: string) { return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000); }

// Colored house tile — the visual anchor of every card (with people when occupied)
function HouseIcon({ color, people }: { color: string; people?: boolean }) {
  return (
    <svg viewBox="0 0 84 64" width="76" height="58" aria-hidden>
      {/* body + roof */}
      <rect x="18" y="30" width="40" height="28" rx="4" fill={color} />
      <path d="M38 7 L64 32 H12 Z" fill={color} />
      <path d="M38 7 L64 32 H54 L38 16 L22 32 H12 Z" fill="#fff" opacity="0.20" />
      {/* door */}
      <rect x="32" y="40" width="12" height="18" rx="3" fill="#fff" opacity="0.92" />
      <circle cx="41" cy="49" r="1.5" fill={color} />
      {/* people (occupied) */}
      {people && (
        <g>
          <circle cx="66" cy="38" r="7" fill={color} />
          <path d="M54 60 c0-8 6-12 12-12 s12 4 12 12 Z" fill={color} />
          <circle cx="66" cy="38" r="7" fill="#fff" opacity="0.22" />
        </g>
      )}
    </svg>
  );
}

interface RoomModal { room: any; guest: { name: string; check_in: string; check_out: string; res_id: number } | null; }

export default function RoomStatusPage() {
  const { t, lang } = useI18n();
  const l = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);   // checked_in (in-house)
  const [arrivals, setArrivals] = useState<any[]>([]);            // confirmed arriving today
  const [guests, setGuests] = useState<any[]>([]);
  const [roomTypeConfigs, setRoomTypeConfigs] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({}); // room_id → balance due
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<string>("");   // "" = Visibles
  const [hideHS, setHideHS] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<RoomModal | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, res, arr, g, types] = await Promise.all([
        api.getRooms(),
        api.getReservations("status=checked_in"),
        api.getReservations("status=confirmed"),
        api.getGuests(),
        api.getRoomTypes(),
      ]);
      setRooms(r); setReservations(res); setGuests(g); setRoomTypeConfigs(types);
      setArrivals((arr || []).filter((a: any) => isSameDay(a.check_in_date)));
      // Balance due per in-house room (total − paid), fetched in parallel.
      // NOTE: this backend's FolioSummary.total is already the net BALANCE due
      // (payments are stored as negative rows), so it IS the Solde dû — don't
      // subtract amount_paid again.
      const sums = await Promise.all((res || []).map((rv: any) =>
        api.getFolioSummary(rv.id)
          .then((s: any) => ({ room_id: rv.room_id, bal: Number(s.total || 0) }))
          .catch(() => null)
      ));
      const map: Record<number, number> = {};
      for (const s of sums) if (s) map[s.room_id] = s.bal;
      setBalances(map);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const guestFor = (roomId: number) => {
    const res = reservations.find(r => r.room_id === roomId);
    if (!res) return null;
    const g = guests.find(g => g.id === res.guest_id);
    return { name: g ? `${g.first_name} ${g.last_name}` : `#${res.guest_id}`, check_in: res.check_in_date, check_out: res.check_out_date, res_id: res.id };
  };
  const arrivalFor = (roomId: number) => arrivals.some(a => a.room_id === roomId);
  const roomTypeName = (type: string) => {
    const cfg = roomTypeConfigs.find(c => c.type_code === type);
    return cfg ? (lang === "fr" ? cfg.name_fr : cfg.name_en) : type;
  };

  const stateOf = (room: any, guest: any, isArrival: boolean): RState => {
    if (room.hk_status === "out_of_order" || room.status === "maintenance") return "hs";
    if (guest && isSameDay(guest.check_out)) return "departure";
    if (room.status === "occupied" || guest) return "occupied";
    if (isArrival) return "arrival";
    return "available";
  };

  // Enrich once
  const enriched = useMemo(() => rooms.map(room => {
    const guest = guestFor(room.id);
    const isArrival = arrivalFor(room.id);
    const st = stateOf(room, guest, isArrival);
    const balance = balances[room.id] || 0;
    return { room, guest, isArrival, st, balance, dirty: room.hk_status === "dirty" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rooms, reservations, arrivals, guests, balances]);

  // Chip counts
  const counts = useMemo(() => {
    const c = { visibles: 0, sejour: 0, occupe: 0, departs: 0, arrivees: 0, impayes: 0, libre: 0, hs: 0 };
    for (const e of enriched) {
      if (e.st === "hs") { c.hs++; continue; }
      c.visibles++;
      if (e.st === "occupied" || e.st === "departure") c.sejour++;
      if (e.st === "occupied") c.occupe++;
      if (e.st === "departure") c.departs++;
      if (e.st === "arrival") c.arrivees++;
      if (e.st === "available") c.libre++;
      if ((e.st === "occupied" || e.st === "departure") && e.balance > 0) c.impayes++;
    }
    return c;
  }, [enriched]);

  const matchesFilter = (e: typeof enriched[number]) => {
    switch (filter) {
      case "sejour":   return e.st === "occupied" || e.st === "departure";
      case "occupe":   return e.st === "occupied";
      case "departs":  return e.st === "departure";
      case "arrivees": return e.st === "arrival";
      case "impayes":  return (e.st === "occupied" || e.st === "departure") && e.balance > 0;
      case "libre":    return e.st === "available";
      case "hs":       return e.st === "hs";
      default:         return true; // visibles
    }
  };
  const matchesSearch = (e: typeof enriched[number]) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return String(e.room.room_number).toLowerCase().includes(q) || (e.guest?.name || "").toLowerCase().includes(q);
  };

  const visible = enriched.filter(e => {
    if (filter === "hs") return matchesSearch(e) && e.st === "hs";
    if (hideHS && e.st === "hs") return false;
    return matchesFilter(e) && matchesSearch(e);
  });

  const floors = [...new Set(visible.map(e => e.room.floor))].sort((a, b) => a - b);

  const openModal = (room: any) => setModal({ room, guest: guestFor(room.id) });
  const handleStatusChange = async (roomId: number, newStatus: string) => {
    setChangingStatus(true);
    try {
      await api.updateRoom(roomId, { status: newStatus });
      await load();
      if (modal) setModal(m => m ? { ...m, room: { ...m.room, status: newStatus } } : null);
    } finally { setChangingStatus(false); }
  };

  const CHIPS: { key: string; label: string; count: number; color?: string }[] = [
    { key: "",         label: l("Visible", "Visibles"),  count: counts.visibles },
    { key: "sejour",   label: l("In-stay", "Séjour"),    count: counts.sejour,  color: STATE_META.occupied.color },
    { key: "occupe",   label: l("Occupied", "Occupé"),   count: counts.occupe,  color: STATE_META.occupied.color },
    { key: "departs",  label: l("Departures", "Départs"),count: counts.departs, color: STATE_META.departure.color },
    { key: "arrivees", label: l("Arrivals", "Arrivées"), count: counts.arrivees,color: STATE_META.arrival.color },
    { key: "impayes",  label: l("Unpaid", "Impayés"),    count: counts.impayes, color: "#dc2626" },
    { key: "libre",    label: l("Free", "Libre"),        count: counts.libre,   color: STATE_META.available.color },
    { key: "hs",       label: "H.S.",                    count: counts.hs,      color: STATE_META.hs.color },
  ];

  const fmt = (n: number) => Number(n).toLocaleString("fr-FR");

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="page-title">{t.room_status_board}</h2>
        <p className="page-subtitle">
          {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={l("Room, guest…", "Chambre, client…")}
          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
      </div>

      {/* Hide H.S. toggle */}
      {counts.hs > 0 && filter !== "hs" && (
        <button onClick={() => setHideHS(v => !v)}
          className="w-full mb-3 px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{ background: hideHS ? "#fef3c7" : "var(--card)", color: hideHS ? "#92400e" : "var(--muted)", border: "1px solid " + (hideHS ? "#fde68a" : "var(--border)") }}>
          🛠️ {hideHS ? l(`Out-of-service hidden (${counts.hs})`, `H.S. masquées (${counts.hs})`) : l(`Show out-of-service (${counts.hs})`, `Afficher H.S. (${counts.hs})`)}
        </button>
      )}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {CHIPS.map(chip => {
          const active = filter === chip.key;
          const c = chip.color || "var(--blue)";
          return (
            <button key={chip.key} onClick={() => setFilter(chip.key)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all border"
              style={active
                ? { background: c, color: "#fff", borderColor: "transparent", boxShadow: `0 2px 10px ${c}40` }
                : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
              {chip.label}
              <span className="text-xs rounded-full px-1.5 font-bold"
                style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--input-bg)", color: chip.color || "var(--muted)" }}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Board */}
      {loading ? (
        <SkeletonCards count={12} height={196} className="grid gap-3" />
      ) : visible.length === 0 ? (
        <EmptyState icon="🏨" message={t.no_rooms_found} />
      ) : (
        floors.map(floor => {
          const items = visible.filter(e => e.room.floor === floor);
          const occ = items.filter(e => e.st === "occupied" || e.st === "departure").length;
          const dep = items.filter(e => e.st === "departure").length;
          const imp = items.filter(e => (e.st === "occupied" || e.st === "departure") && e.balance > 0).length;
          return (
            <div key={floor} className="mb-7">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-extrabold uppercase tracking-wider" style={{ color: "var(--text)" }}>
                  {t.floor_label} {floor}
                </span>
                <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>{items.length}</span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {occ}/{items.length} {l("occupied", "occupées")} · {dep} {l("departures", "départs")} · {imp} {l("unpaid", "impayés")}
                </span>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {items.map(({ room, guest, st, balance, dirty }) => {
                  const meta = STATE_META[st];
                  const withPeople = st === "occupied" || st === "departure";
                  return (
                    <button key={room.id} onClick={() => openModal(room)}
                      className="transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col items-stretch"
                      style={{ height: 206, background: "var(--card)", border: `2px solid ${meta.color}`, borderRadius: 18, padding: "10px 12px", cursor: "pointer" }}>
                      {/* Top: room number + status pill */}
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 21, fontWeight: 800, color: meta.color, lineHeight: 1 }}>{room.room_number}</span>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: meta.color, color: "#fff" }}>
                          {lang === "fr" ? meta.fr : meta.en}
                        </span>
                      </div>

                      {/* Middle: house icon */}
                      <div className="flex-1 flex items-center justify-center"><HouseIcon color={meta.color} people={withPeople} /></div>

                      {/* Bottom: guest / price / balance — fixed block keeps every card equal height */}
                      <div className="text-center" style={{ minHeight: 56 }}>
                        {guest ? (
                          <p className="text-sm font-extrabold uppercase leading-tight truncate" style={{ color: "var(--text)" }}>{guest.name}</p>
                        ) : (
                          <p className="text-sm font-semibold" style={{ color: "var(--muted)" }}>{t.floor_label} {room.floor}</p>
                        )}
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{fmt(room.price_per_night)} FCFA{t.per_night}</p>
                        {balance > 0 && (
                          <p className="text-xs font-bold" style={{ color: "#dc2626" }}>{l("Balance", "Solde dû")}: {fmt(balance)}</p>
                        )}
                      </div>

                      {/* Housekeeping badge */}
                      {dirty && (
                        <div className="text-center mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "#fdf3d3", color: "#92702a" }}>
                            {l("Dirty", "Sale")}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Room detail modal (unchanged behaviour) */}
      {modal && (() => {
        const { room, guest } = modal;
        const qs = QUICK_STATUS[room.status] || QUICK_STATUS.available;
        const daysOut = guest ? daysUntil(guest.check_out) : null;
        const daysIn = guest ? daysAgo(guest.check_in) : null;
        const bal = balances[room.id] || 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(30,37,50,0.5)" }} onClick={() => setModal(null)}>
            <div className="card w-full max-w-sm" style={{ padding: 0 }} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 rounded-t-xl" style={{ background: qs.bg, borderBottom: `3px solid ${qs.color}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: qs.color }}>{t.room_number} {room.room_number}</h3>
                    <p className="text-sm mt-0.5" style={{ color: qs.color, opacity: 0.8 }}>{roomTypeName(room.room_type)} · {t.floor_label} {room.floor}</p>
                  </div>
                  <button onClick={() => setModal(null)} style={{ color: qs.color, opacity: 0.7, fontSize: 20 }}>✕</button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ background: qs.color, color: "#fff" }}>{lang === "fr" ? qs.fr : qs.en}</span>
                  {room.hk_status === "dirty" && <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>{l("Dirty", "Sale")}</span>}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {guest ? (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--input-bg)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "#2563eb" }}>{guest.name.charAt(0)}</div>
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{guest.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><p style={{ color: "var(--muted)" }}>{t.checkin_date_label}</p><p className="font-semibold" style={{ color: "var(--text)" }}>{guest.check_in}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>{t.checkout_date_label}</p><p className="font-semibold" style={{ color: daysOut !== null && daysOut <= 0 ? "#dc2626" : "var(--text)" }}>{guest.check_out}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>{t.days_in_house}</p><p className="font-semibold" style={{ color: "var(--text)" }}>{daysIn ?? 0}</p></div>
                      <div><p style={{ color: "var(--muted)" }}>{t.nights_remaining}</p><p className="font-semibold" style={{ color: daysOut !== null && daysOut <= 1 ? "#dc2626" : "#16a34a" }}>{daysOut !== null ? Math.max(0, daysOut) : "—"}</p></div>
                    </div>
                    {bal > 0 && (
                      <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: "1px solid var(--border)" }}>
                        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{l("Balance due", "Solde dû")}</span>
                        <span className="text-sm font-extrabold" style={{ color: "#dc2626" }}>{fmt(bal)} FCFA</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center" style={{ background: "var(--input-bg)" }}>
                    <p className="text-3xl mb-1">🛏️</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>{t.vacant}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{fmt(room.price_per_night)} FCFA{t.per_night}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>{t.quick_status}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ORDER.map(s => {
                      const sm = QUICK_STATUS[s];
                      const isCurrent = room.status === s;
                      return (
                        <button key={s} disabled={isCurrent || changingStatus} onClick={() => handleStatusChange(room.id, s)}
                          className="py-2 px-3 rounded-xl text-xs font-semibold border transition-all disabled:opacity-60"
                          style={isCurrent ? { background: sm.color, color: "#fff", borderColor: sm.color } : { background: sm.bg, color: sm.color, borderColor: sm.border }}>
                          {lang === "fr" ? sm.fr : sm.en}{isCurrent && " ✓"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
