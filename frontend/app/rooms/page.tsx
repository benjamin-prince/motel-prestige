"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Room } from "@/lib/types";
import { useProperty, getFloors } from "@/lib/property-context";
import { usePermissions } from "@/lib/permissions";
import { Modal, ConfirmDialog, SearchInput, SegmentedControl, EmptyState, SkeletonCards } from "@/components/ui";

const STATUS_DOT: Record<string, string> = {
  available: "#43a047", occupied: "#fb8c00", cleaning: "#fdd835", maintenance: "#e53935",
};
const STATUS_BG: Record<string, { bg: string; color: string }> = {
  available:   { bg: "var(--good-bg)", color: "var(--good)" },
  occupied:    { bg: "var(--info-bg)", color: "var(--info)" },
  cleaning:    { bg: "var(--warn-bg)", color: "var(--warn)" },
  maintenance: { bg: "var(--bad-bg)", color: "var(--bad)" },
};

const EMPTY_FORM = { room_number: "", room_type: "single", floor: 1, price_per_night: "", price_short_stay: "", stay_offer: "OS", max_occupancy: 2, description: "" };

export default function RoomsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { can } = usePermissions();
  const { current } = useProperty();
  const siteFloors = getFloors(current);
  const floorName = (f: number) => siteFloors.find(x => x.floor === f)?.label || "";
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypeConfigs, setRoomTypeConfigs] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFloor, setFilterFloor] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<Room | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, types, st] = await Promise.all([
        api.getRooms(""),
        api.getRoomTypes(),
        api.getLookup("room_status"),
      ]);
      setRooms(r);
      setRoomTypeConfigs(types);
      setStatuses(st);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Every floor of the site (from Settings → Sites), plus any floor that already has rooms
  const floors = [...new Set([...siteFloors.map(f => f.floor), ...rooms.map(r => r.floor)])].sort((a, b) => a - b);

  // "available/total" badge for a subset of rooms, e.g. 2/4
  const availBadge = (pred: (r: Room) => boolean) => {
    const sub = rooms.filter(pred);
    return `${sub.filter(r => r.status === "available").length}/${sub.length}`;
  };

  const filtered = rooms.filter(r =>
    (!filterStatus || r.status === filterStatus) &&
    (!filterFloor || String(r.floor) === filterFloor) &&
    (!filterType || r.room_type === filterType) &&
    (!search || r.room_number.includes(search) || r.room_type.toLowerCase().includes(search.toLowerCase()))
  );

  const getRoomImage = (type: string) => roomTypeConfigs.find(c => c.type_code === type)?.default_image_url || null;
  const getRoomTypeName = (type: string) => {
    const cfg = roomTypeConfigs.find(c => c.type_code === type);
    if (!cfg) return type;
    return lang === "fr" ? cfg.name_fr : cfg.name_en;
  };
  const getStatusLabel = (val: string) => {
    const s = statuses.find(s => s.value_en === val);
    return s ? (lang === "fr" ? s.value_fr : s.value_en) : val;
  };

  const stats = [
    { label: t.total_rooms, count: rooms.length, val: "" },
    ...statuses.map(s => ({
      label: lang === "fr" ? s.value_fr : s.value_en,
      count: rooms.filter(r => r.status === s.value_en).length,
      val: s.value_en,
    })),
  ];

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, floor: siteFloors[0]?.floor ?? EMPTY_FORM.floor });
    setShowForm(true);
  };
  const openEdit = (room: Room) => {
    setEditing(room);
    setForm({ room_number: room.room_number, room_type: room.room_type, floor: room.floor, price_per_night: String(room.price_per_night), price_short_stay: room.price_short_stay ? String(room.price_short_stay) : "", stay_offer: room.stay_offer || "OS", max_occupancy: room.max_occupancy, description: room.description || "" });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // A room only carries prices for the stay types it is sold as.
    const sellsOS = form.stay_offer !== "SS", sellsSS = form.stay_offer !== "OS";
    const payload = { ...form, floor: Number(form.floor),
      price_per_night: sellsOS ? Number(form.price_per_night) : 0,
      price_short_stay: sellsSS ? Number(form.price_short_stay) || 0 : 0,
      max_occupancy: Number(form.max_occupancy) };
    if (editing) { await api.updateRoom(editing.id, payload); }
    else { await api.createRoom(payload); }
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deleteRoom(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.manage_rooms}</h2>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          + {t.add_room}
        </button>
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {stats.map(s => (
          <button key={s.val} onClick={() => setFilterStatus(s.val)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={filterStatus === s.val
              ? { background: "var(--blue)", color: "#fff", boxShadow: "0 2px 8px rgba(59,91,219,0.25)" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            {s.label}
            <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
              style={filterStatus === s.val ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Floor filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={t.search_rooms} />
        <SegmentedControl value={filterFloor} onChange={setFilterFloor}
          options={[
            { value: "", label: t.all_floors, badge: availBadge(() => true) },
            ...floors.map(f => ({
              value: String(f),
              label: floorName(f) ? `${t.floor_label} ${f} — ${floorName(f)}` : `${t.floor_label} ${f}`,
              badge: availBadge(r => r.floor === f),
            })),
          ]} />
        <SegmentedControl value={filterType} onChange={setFilterType}
          options={[
            { value: "", label: t.all_types, badge: availBadge(() => true) },
            ...roomTypeConfigs.map(cfg => ({
              value: cfg.type_code,
              label: lang === "fr" ? cfg.name_fr : cfg.name_en,
              badge: availBadge(r => r.room_type === cfg.type_code),
            })),
          ]} />
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonCards count={10} height={240} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🛏️" message={t.no_rooms_found} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(room => {
            const st = STATUS_BG[room.status] || { bg: "#f5f5f5", color: "#555" };
            const dot = STATUS_DOT[room.status] || "#999";
            return (
              <div key={room.id} className="card overflow-hidden group" style={{ padding: 0 }}>
                <div className="relative overflow-hidden" style={{ height: 130 }}>
                  {getRoomImage(room.room_type)
                    ? <img src={getRoomImage(room.room_type)!} alt={room.room_type} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full flex items-center justify-center text-5xl" style={{ background: "var(--input-bg)" }}>🛏️</div>
                  }
                  <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: st.bg, color: st.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                    {getStatusLabel(room.status)}
                  </span>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: "rgba(0,0,0,0.45)" }}>
                    {t.floor_label} {room.floor}
                  </span>
                  {/* Action overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => openEdit(room)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow hover:bg-blue-50 transition-colors">
                      {t.edit}
                    </button>
                    <button onClick={() => setConfirmDelete(room)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-red-600 shadow hover:bg-red-50 transition-colors">
                      {t.delete}
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>#{room.room_number}</span>
                    <span className="text-right" style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)" }}>
                      {room.stay_offer !== "SS" && (
                        <span className="block">
                          {Number(room.price_per_night).toLocaleString("fr-FR")}
                          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}> FCFA{t.per_night}</span>
                        </span>
                      )}
                      {room.stay_offer !== "OS" && Number(room.price_short_stay) > 0 && (
                        <span className="block" style={{ fontSize: 11, fontWeight: 600, color: "#d97706" }}>
                          {Number(room.price_short_stay).toLocaleString("fr-FR")}
                          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--muted)" }}> FCFA/{t.per_2h}</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="text-xs mb-2" style={{ color: "var(--muted)" }}>
                    {getRoomTypeName(room.room_type)} · {t.max_occupancy} {room.max_occupancy}
                  </div>
                  <select value={room.status}
                    onChange={e => api.updateRoom(room.id, { status: e.target.value }).then(load)}
                    className="field-input text-xs" style={{ fontSize: 11, padding: "4px 8px" }}>
                    {statuses.map(s => (
                      <option key={s.value_en} value={s.value_en}>
                        {lang === "fr" ? s.value_fr : s.value_en}
                      </option>
                    ))}
                  </select>
                  {room.status === "available" && can("fo.res.create") && (
                    <button onClick={() => router.push(`/reservations?room=${room.id}`)}
                      className="w-full mt-2 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t.book_room}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <Modal title={editing ? `${t.edit} #${editing.room_number}` : `+ ${t.add_room}`}
          onClose={() => { setShowForm(false); setEditing(null); }}>
            <form onSubmit={handleSave} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t.room_number}</label>
                  <input required value={form.room_number}
                    onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
                    className="field-input" placeholder="101" disabled={!!editing} />
                </div>
                <div>
                  <label className="field-label">{t.floor}</label>
                  {siteFloors.length > 0 ? (
                    <>
                      <select required value={form.floor}
                        onChange={e => setForm(f => ({ ...f, floor: Number(e.target.value) }))}
                        className="field-input">
                        {/* Floors come from the site setup; keep an out-of-range floor
                            selectable when editing a room created before the setup. */}
                        {(siteFloors.some(fl => fl.floor === form.floor)
                          ? siteFloors
                          : [...siteFloors, { floor: form.floor, label: "" }].sort((a, b) => a.floor - b.floor)
                        ).map(fl => (
                          <option key={fl.floor} value={fl.floor}>
                            {t.floor_label} {fl.floor}{fl.label ? ` — ${fl.label}` : ""}
                            {!siteFloors.some(s => s.floor === fl.floor) ? " ⚠" : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {t.floors_from_site_setup}
                      </p>
                    </>
                  ) : (
                    <input type="number" required value={form.floor}
                      onChange={e => setForm(f => ({ ...f, floor: Number(e.target.value) }))}
                      className="field-input" />
                  )}
                </div>
                <div className="col-span-2">
                  <label className="field-label">{t.room_stay_offer}</label>
                  <select value={form.stay_offer}
                    onChange={e => setForm(f => ({ ...f, stay_offer: e.target.value }))}
                    className="field-input">
                    <option value="OS">🌙 {t.overnight_stay}</option>
                    <option value="SS">⏱️ {t.short_stay_2h}</option>
                    <option value="BOTH">🌙⏱️ {t.offer_both}</option>
                  </select>
                </div>
                {form.stay_offer !== "SS" && (
                  <div>
                    <label className="field-label">{t.price_per_night}</label>
                    <input type="number" required min={1} value={form.price_per_night}
                      onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))}
                      className="field-input" />
                  </div>
                )}
                {form.stay_offer !== "OS" && (
                  <div>
                    <label className="field-label">{t.price_short_stay_label}</label>
                    <input type="number" required min={1} value={form.price_short_stay}
                      onChange={e => setForm(f => ({ ...f, price_short_stay: e.target.value }))}
                      className="field-input" />
                  </div>
                )}
                <div>
                  <label className="field-label">{t.max_occupancy}</label>
                  <input type="number" required value={form.max_occupancy}
                    onChange={e => setForm(f => ({ ...f, max_occupancy: Number(e.target.value) }))}
                    className="field-input" />
                </div>
                <div className="col-span-2">
                  <label className="field-label">{t.room_type}</label>
                  <select value={form.room_type} onChange={e => setForm(f => ({ ...f, room_type: e.target.value }))} className="field-input">
                    {roomTypeConfigs.map(cfg => (
                      <option key={cfg.type_code} value={cfg.type_code}>
                        {lang === "fr" ? cfg.name_fr : cfg.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">{t.description}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="field-input" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">{t.save}</button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                  className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              </div>
            </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${t.delete} #${confirmDelete.room_number}?`}
          message={t.confirm_delete}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
