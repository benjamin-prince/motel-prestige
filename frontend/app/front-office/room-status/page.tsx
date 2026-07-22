"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { EmptyState, SkeletonCards } from "@/components/ui";

const STATUS_META: Record<string, { color: string; bg: string; border: string; label_en: string; label_fr: string }> = {
  available:   { color: "#059669", bg: "#dcfce7", border: "#86efac", label_en: "Available",    label_fr: "Disponible" },
  occupied:    { color: "#d97706", bg: "#fef3c7", border: "#fcd34d", label_en: "Occupied",     label_fr: "Occupée" },
  cleaning:    { color: "#0891b2", bg: "#cffafe", border: "#67e8f9", label_en: "Cleaning",     label_fr: "En Nettoyage" },
  maintenance: { color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", label_en: "Maintenance",  label_fr: "Maintenance" },
};

const STATUS_ORDER = ["available", "occupied", "cleaning", "maintenance"] as const;

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

interface RoomModal {
  room: any;
  guest: { name: string; check_in: string; check_out: string; res_id: number } | null;
}

export default function RoomStatusPage() {
  const { t, lang } = useI18n();
  const [rooms, setRooms] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [roomTypeConfigs, setRoomTypeConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFloor, setFilterFloor] = useState("");
  const [modal, setModal] = useState<RoomModal | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, res, g, st, types] = await Promise.all([
        api.getRooms(),
        api.getReservations("status=checked_in"),
        api.getGuests(),
        api.getLookup("room_status"),
        api.getRoomTypes(),
      ]);
      setRooms(r); setReservations(res); setGuests(g); setStatuses(st); setRoomTypeConfigs(types);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getRoomGuest = (roomId: number) => {
    const res = reservations.find(r => r.room_id === roomId);
    if (!res) return null;
    const g = guests.find(g => g.id === res.guest_id);
    return { name: g ? `${g.first_name} ${g.last_name}` : `#${res.guest_id}`, check_in: res.check_in_date, check_out: res.check_out_date, res_id: res.id };
  };

  const getRoomTypeName = (type: string) => {
    const cfg = roomTypeConfigs.find(c => c.type_code === type);
    return cfg ? (lang === "fr" ? cfg.name_fr : cfg.name_en) : type;
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  const filtered = rooms.filter(r =>
    (!filterStatus || r.status === filterStatus) &&
    (!filterFloor || String(r.floor) === filterFloor)
  );

  const counts: Record<string, number> = { "": rooms.length };
  for (const r of rooms) counts[r.status] = (counts[r.status] || 0) + 1;

  const openModal = (room: any) => setModal({ room, guest: getRoomGuest(room.id) });

  const handleStatusChange = async (roomId: number, newStatus: string) => {
    setChangingStatus(true);
    try {
      await api.updateRoom(roomId, { status: newStatus });
      await load();
      if (modal) setModal(m => m ? { ...m, room: { ...m.room, status: newStatus } } : null);
    } finally { setChangingStatus(false); }
  };

  // Group filtered rooms by floor
  const byFloor = floors.reduce<Record<number, any[]>>((acc, f) => {
    const fRooms = filtered.filter(r => r.floor === f);
    if (fRooms.length) acc[f] = fRooms;
    return acc;
  }, {});

  const l = (en: string, fr: string) => lang === "fr" ? fr : en;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="page-title">{t.room_status_board}</h2>
          <p className="page-subtitle">
            {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Stats / filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[{ val: "", label: t.all, count: counts[""] }, ...STATUS_ORDER.map(s => ({
          val: s,
          label: lang === "fr" ? STATUS_META[s].label_fr : STATUS_META[s].label_en,
          count: counts[s] || 0,
        }))].map(chip => {
          const meta = chip.val ? STATUS_META[chip.val] : null;
          const active = filterStatus === chip.val;
          return (
            <button key={chip.val} onClick={() => setFilterStatus(chip.val)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={active
                ? { background: meta?.color || "var(--blue)", color: "#fff", borderColor: "transparent", boxShadow: `0 2px 10px ${meta?.color || "var(--blue)"}40` }
                : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}>
              {meta && <span className="w-2 h-2 rounded-full" style={{ background: active ? "rgba(255,255,255,0.7)" : meta.color }} />}
              {chip.label}
              <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
                style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Floor tabs */}
      {floors.length > 1 && (
        <div className="flex gap-1 p-1 rounded-xl mb-5 self-start" style={{ background: "var(--input-bg)", width: "fit-content" }}>
          <button onClick={() => setFilterFloor("")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={!filterFloor ? { background: "var(--blue)", color: "#fff" } : { color: "var(--muted)" }}>
            {t.all_floors}
          </button>
          {floors.map(f => (
            <button key={f} onClick={() => setFilterFloor(String(f))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={filterFloor === String(f) ? { background: "var(--blue)", color: "#fff" } : { color: "var(--muted)" }}>
              {t.floor_label} {f}
            </button>
          ))}
        </div>
      )}

      {/* Room grid grouped by floor */}
      {loading ? (
        <SkeletonCards count={12} height={130} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🏨" message={t.no_rooms_found} />
      ) : (
        Object.entries(byFloor).map(([floorNum, floorRooms]) => (
          <div key={floorNum} className="mb-7">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {t.floor_label} {floorNum}
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs" style={{ color: "var(--muted)" }}>{floorRooms.length} {l("rooms", "chambres")}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {floorRooms.map(room => {
                const meta = STATUS_META[room.status] || STATUS_META.available;
                const guestInfo = getRoomGuest(room.id);
                const daysOut = guestInfo ? daysUntil(guestInfo.check_out) : null;
                const checkingOutToday = daysOut === 0;
                return (
                  <button key={room.id} onClick={() => openModal(room)}
                    className="card text-left transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden"
                    style={{ padding: 0, borderLeft: `4px solid ${meta.color}`, cursor: "pointer" }}>
                    {checkingOutToday && (
                      <div className="absolute top-0 right-0 text-xs font-bold px-2 py-0.5 rounded-bl-lg"
                        style={{ background: "#dc2626", color: "#fff", fontSize: 9 }}>
                        {t.checkout_today}
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
                          {room.room_number}
                        </span>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: meta.bg, color: meta.color }}>
                          {lang === "fr" ? meta.label_fr : meta.label_en}
                        </span>
                      </div>
                      <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                        {getRoomTypeName(room.room_type)}
                      </p>
                      {guestInfo ? (
                        <div>
                          <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>
                            {guestInfo.name}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: daysOut !== null && daysOut <= 1 ? "#dc2626" : "var(--muted)" }}>
                            {daysOut !== null && daysOut > 0
                              ? `${daysOut} ${t.nights_remaining}`
                              : daysOut === 0
                              ? t.checkout_today
                              : `${Math.abs(daysOut!)} ${l("days overdue", "jours dépassés")}`}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{t.vacant}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Room Detail Modal */}
      {modal && (() => {
        const { room, guest } = modal;
        const meta = STATUS_META[room.status] || STATUS_META.available;
        const daysOut = guest ? daysUntil(guest.check_out) : null;
        const daysIn = guest ? daysAgo(guest.check_in) : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(30,37,50,0.5)" }} onClick={() => setModal(null)}>
            <div className="card w-full max-w-sm" style={{ padding: 0 }}
              onClick={e => e.stopPropagation()}>
              {/* Header with status color bar */}
              <div className="px-5 py-4 rounded-t-xl" style={{ background: meta.bg, borderBottom: `3px solid ${meta.color}` }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 800, color: meta.color }}>
                      {t.room_number} {room.room_number}
                    </h3>
                    <p className="text-sm mt-0.5" style={{ color: meta.color, opacity: 0.8 }}>
                      {getRoomTypeName(room.room_type)} · {t.floor_label} {room.floor}
                    </p>
                  </div>
                  <button onClick={() => setModal(null)} style={{ color: meta.color, opacity: 0.7, fontSize: 20 }}>✕</button>
                </div>
                <div className="mt-2">
                  <span className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ background: meta.color, color: "#fff" }}>
                    {lang === "fr" ? meta.label_fr : meta.label_en}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Guest info */}
                {guest ? (
                  <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--input-bg)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: "#3b5bdb" }}>
                        {guest.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{guest.name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p style={{ color: "var(--muted)" }}>{t.checkin_date_label}</p>
                        <p className="font-semibold" style={{ color: "var(--text)" }}>{guest.check_in}</p>
                      </div>
                      <div>
                        <p style={{ color: "var(--muted)" }}>{t.checkout_date_label}</p>
                        <p className="font-semibold" style={{ color: daysOut !== null && daysOut <= 0 ? "#dc2626" : "var(--text)" }}>
                          {guest.check_out}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "var(--muted)" }}>{t.days_in_house}</p>
                        <p className="font-semibold" style={{ color: "var(--text)" }}>{daysIn ?? 0}</p>
                      </div>
                      <div>
                        <p style={{ color: "var(--muted)" }}>{t.nights_remaining}</p>
                        <p className="font-semibold" style={{ color: daysOut !== null && daysOut <= 1 ? "#dc2626" : "#059669" }}>
                          {daysOut !== null ? Math.max(0, daysOut) : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center" style={{ background: "var(--input-bg)" }}>
                    <p className="text-3xl mb-1">🛏️</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>{t.vacant}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {Number(room.price_per_night).toLocaleString("fr-FR")} FCFA{t.per_night}
                    </p>
                  </div>
                )}

                {/* Quick Status */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--muted)" }}>
                    {t.quick_status}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_ORDER.map(s => {
                      const sm = STATUS_META[s];
                      const isCurrent = room.status === s;
                      return (
                        <button key={s} disabled={isCurrent || changingStatus}
                          onClick={() => handleStatusChange(room.id, s)}
                          className="py-2 px-3 rounded-xl text-xs font-semibold border transition-all disabled:opacity-60"
                          style={isCurrent
                            ? { background: sm.color, color: "#fff", borderColor: sm.color }
                            : { background: sm.bg, color: sm.color, borderColor: sm.border }}>
                          {lang === "fr" ? sm.label_fr : sm.label_en}
                          {isCurrent && " ✓"}
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
