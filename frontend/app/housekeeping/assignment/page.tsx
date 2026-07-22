"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useProperty, getFloors } from "@/lib/property-context";
import { Modal, SkeletonCards } from "@/components/ui";

const HK_STATUS = {
  dirty:          { color: "#ef4444", bg: "#fef2f2", dot: "#dc2626", tKey: "hk_status_dirty",   gradient: "linear-gradient(135deg,#dc2626,#ef4444)" },
  cleaning:       { color: "#f59e0b", bg: "#fffbeb", dot: "#d97706", tKey: "hk_status_cleaning", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
  clean:          { color: "#22c55e", bg: "#f0fdf4", dot: "#16a34a", tKey: "hk_status_clean",    gradient: "linear-gradient(135deg,#16a34a,#22c55e)" },
  inspected:      { color: "#3b82f6", bg: "#eff6ff", dot: "#2563eb", tKey: "hk_status_inspected",gradient: "linear-gradient(135deg,#2563eb,#3b82f6)" },
  do_not_disturb: { color: "#8b5cf6", bg: "#f5f3ff", dot: "#7c3aed", tKey: "hk_status_dnd",     gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
  out_of_order:   { color: "#6b7280", bg: "#f9fafb", dot: "#4b5563", tKey: "hk_status_oor",     gradient: "linear-gradient(135deg,#4b5563,#6b7280)" },
} as const;
type HKStatusKey = keyof typeof HK_STATUS;
const STATUS_ORDER: HKStatusKey[] = ["dirty","cleaning","clean","inspected","do_not_disturb","out_of_order"];

const TASK_TYPES = ["cleaning","turndown","deep_clean","inspection"] as const;
const PRIORITIES  = ["normal","priority","urgent"] as const;

function RoomCard({ room, selected, t, lang, onSelect, onClick }: {
  room: any; selected: boolean; t: any; lang: string;
  onSelect: (id: number) => void; onClick: (room: any) => void;
}) {
  const meta = (HK_STATUS as any)[room.hk_status] ?? HK_STATUS.clean;
  return (
    <div
      className="relative rounded-xl border-2 p-3 cursor-pointer transition-all select-none"
      style={{ borderColor: selected ? meta.color : meta.color + "55", background: selected ? meta.color + "18" : meta.bg,
        boxShadow: selected ? `0 0 0 3px ${meta.color}28` : undefined }}
      onClick={() => onClick(room)}>
      <div className="absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: selected ? meta.color : "var(--border)", background: selected ? meta.color : "transparent" }}
        onClick={e => { e.stopPropagation(); onSelect(room.id); }}>
        {selected && <span className="text-white text-xs font-black leading-none">✓</span>}
      </div>
      <div className="font-black text-xl leading-none" style={{ color: meta.color }}>{room.room_number}</div>
      <div className="text-xs mt-0.5 truncate pr-5" style={{ color: "var(--muted)" }}>{room.room_type}</div>
      <div className="mt-2 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
        <span className="text-xs font-semibold truncate" style={{ color: meta.color }}>
          {(t as any)[meta.tKey]}
        </span>
      </div>
      <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.floor_label} {room.floor}</div>
    </div>
  );
}

function RoomModal({ room, t, lang, users, onClose, onUpdated }: {
  room: any; t: any; lang: string; users: any[]; onClose: () => void; onUpdated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ task_type: "cleaning", priority: "normal", assigned_to: "", scheduled_date: new Date().toISOString().split("T")[0], notes: "" });
  const [creating, setCreating] = useState(false);
  const meta = (HK_STATUS as any)[room.hk_status] ?? HK_STATUS.clean;

  const changeStatus = async (status: string) => {
    setSaving(true);
    try { await api.updateHKRoomStatus(room.id, status); onUpdated(); onClose(); }
    finally { setSaving(false); }
  };
  const createTask = async () => {
    setCreating(true);
    try {
      await api.createHKTask({ room_id: room.id, task_type: form.task_type, priority: form.priority,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
        scheduled_date: form.scheduled_date, notes: form.notes || undefined });
      onUpdated(); onClose();
    } finally { setCreating(false); }
  };

  return (
    <Modal onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="text-2xl font-black" style={{ color: meta.color }}>{room.room_number}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: meta.color + "18", color: meta.color }}>
            {(t as any)[meta.tKey]}
          </span>
          <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>{room.room_type} · {t.floor_label} {room.floor}</span>
        </span>
      }>
      <div className="p-6 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>{t.change_status}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STATUS_ORDER.map(s => {
              const m = HK_STATUS[s];
              const active = room.hk_status === s;
              return (
                <button key={s} disabled={saving || active} onClick={() => changeStatus(s)}
                  className="py-2 px-2 rounded-lg text-xs font-semibold border transition-all"
                  style={active ? { borderColor: m.color, background: m.color + "25", color: m.color }
                    : { borderColor: "var(--border)", color: "var(--text)", opacity: saving ? 0.5 : 1 }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.dot }} />
                    <span className="truncate">{(t as any)[m.tKey]}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{t.create_task}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t.task_type}</label>
              <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} className="field-input">
                {TASK_TYPES.map(k => <option key={k} value={k}>{(t as any)[`task_type_${k}`]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t.type}</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="field-input">
                {PRIORITIES.map(k => <option key={k} value={k}>{(t as any)[`priority_${k}`]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">{t.assign_to_staff}</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="field-input">
              <option value="">— {t.hk_unassigned} —</option>
              {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.scheduled_date}</label>
            <input type="date" value={form.scheduled_date}
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t.notes}</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="field-input" />
          </div>
          <button onClick={createTask} disabled={creating} className="btn-primary w-full" style={{ opacity: creating ? 0.6 : 1 }}>
            {creating ? t.loading : t.create_task}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BulkModal({ selectedIds, t, lang, users, rooms, onClose, onDone }: {
  selectedIds: number[]; t: any; lang: string; users: any[]; rooms: any[]; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({ task_type: "cleaning", priority: "normal", assigned_to: "", scheduled_date: new Date().toISOString().split("T")[0], also_set_status: "cleaning", change_status: true });
  const [saving, setSaving] = useState(false);
  const selectedRooms = rooms.filter(r => selectedIds.includes(r.id));

  const submit = async () => {
    setSaving(true);
    try {
      for (const id of selectedIds) {
        await api.createHKTask({ room_id: id, task_type: form.task_type, priority: form.priority,
          assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined, scheduled_date: form.scheduled_date });
        if (form.change_status) await api.updateHKRoomStatus(id, form.also_set_status);
      }
      onDone(); onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal maxWidth="max-w-lg" onClose={onClose}
      title={
        <span>
          {t.bulk_assign}
          <span className="block text-xs font-normal mt-0.5" style={{ color: "var(--muted)" }}>{selectedIds.length} {t.rooms_selected}</span>
        </span>
      }>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {selectedRooms.map(r => {
            const m = (HK_STATUS as any)[r.hk_status] ?? HK_STATUS.clean;
            return <span key={r.id} className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: m.color + "18", color: m.color }}>{r.room_number}</span>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.task_type}</label>
            <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} className="field-input">
              {TASK_TYPES.map(k => <option key={k} value={k}>{(t as any)[`task_type_${k}`]}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.type}</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="field-input">
              {PRIORITIES.map(k => <option key={k} value={k}>{(t as any)[`priority_${k}`]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="field-label">{t.assign_to_staff}</label>
          <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="field-input">
            <option value="">— {t.hk_unassigned} —</option>
            {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">{t.scheduled_date}</label>
          <input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} className="field-input" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative w-10 h-5 shrink-0">
            <input type="checkbox" className="sr-only" checked={form.change_status} onChange={e => setForm(f => ({ ...f, change_status: e.target.checked }))} />
            <div className="w-10 h-5 rounded-full transition-colors" style={{ background: form.change_status ? "#3b82f6" : "var(--border)" }} />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: form.change_status ? "translateX(20px)" : "none" }} />
          </div>
          <span className="text-sm" style={{ color: "var(--text)" }}>{t.hk_also_set_status}:</span>
          {form.change_status && (
            <select value={form.also_set_status} onChange={e => setForm(f => ({ ...f, also_set_status: e.target.value }))} className="field-input" style={{ width: "auto", marginTop: 0 }}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{(t as any)[HK_STATUS[s].tKey]}</option>)}
            </select>
          )}
        </label>
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? t.loading : `${t.bulk_assign} (${selectedIds.length})`}
        </button>
      </div>
    </Modal>
  );
}

export default function HousekeepingAssignmentPage() {
  const { t, lang } = useI18n();
  const { current } = useProperty();
  const siteFloors = getFloors(current);
  const floorName = (f: number) => siteFloors.find(x => x.floor === f)?.label || "";
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]);
  const [filterFloor, setFilterFloor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [showBulk, setShowBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const [r, u] = await Promise.all([api.getHKRooms(), api.getUsersBasic()]); setRooms(r); setUsers(u); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
  const filtered = rooms.filter(r => {
    if (filterFloor !== "all" && String(r.floor) !== filterFloor) return false;
    if (filterStatus !== "all" && r.hk_status !== filterStatus) return false;
    return true;
  });
  const toggleSelect = (id: number) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const byFloor: Record<number, any[]> = {};
  filtered.forEach(r => { byFloor[r.floor] = byFloor[r.floor] || []; byFloor[r.floor].push(r); });
  const floorKeys = Object.keys(byFloor).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t.hk_board}</h1>
          <p className="page-subtitle">{rooms.length} {t.hk_board_desc}</p>
        </div>
        {selected.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setSelected([])} className="btn-secondary text-sm">{t.hk_clear} ({selected.length})</button>
            <button onClick={() => setShowBulk(true)} className="btn-primary text-sm">{t.bulk_assign} ({selected.length})</button>
          </div>
        )}
      </div>

      {/* Gradient KPI status cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_ORDER.map(s => {
          const m = HK_STATUS[s];
          const count = rooms.filter(r => r.hk_status === s).length;
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(active ? "all" : s)}
              className="relative overflow-hidden rounded-xl p-4 text-left transition-all hover:opacity-90 border-2"
              style={active
                ? { background: m.gradient, border: "none", boxShadow: `0 4px 14px ${m.color}40` }
                : { background: "var(--card)", borderColor: "var(--border)" }}>
              <div className={`absolute -right-2 -bottom-2 text-5xl opacity-10`}>●</div>
              <div className="text-2xl font-black mb-1" style={{ color: active ? "#fff" : m.color }}>{loading ? "—" : count}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? "rgba(255,255,255,0.7)" : m.dot }} />
                <span className="text-xs font-semibold truncate" style={{ color: active ? "rgba(255,255,255,0.9)" : m.color }}>
                  {(t as any)[m.tKey]}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center" style={{ padding: "12px 16px" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{t.floor_label}</span>
          <select value={filterFloor} onChange={e => setFilterFloor(e.target.value)}
            className="field-input" style={{ width: "auto", marginTop: 0, paddingTop: 4, paddingBottom: 4 }}>
            <option value="all">{t.all_floors}</option>
            {floors.map(f => <option key={f} value={String(f)}>{t.floor_label} {f}</option>)}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setSelected(filtered.map(r => r.id))}
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {t.select_all} ({filtered.length})
          </button>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])}
              className="text-xs px-3 py-1.5 rounded-lg border"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              {t.hk_clear}
            </button>
          )}
        </div>
      </div>

      {/* Room grid by floor */}
      {loading ? (
        <SkeletonCards count={12} height={84} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" />
      ) : floorKeys.length === 0 ? (
        <div className="card text-center py-12" style={{ color: "var(--muted)" }}>{t.no_data}</div>
      ) : floorKeys.map(floor => (
        <div key={floor} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white"
              style={{ background: "var(--muted)" }}>{floor}</div>
            <span className="font-bold text-sm" style={{ color: "var(--text)" }}>
              {t.floor_label} {floor}{floorName(floor) ? ` — ${floorName(floor)}` : ""}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>— {byFloor[floor].length} {t.hk_rooms}</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {byFloor[floor].map(room => (
              <RoomCard key={room.id} room={room} selected={selected.includes(room.id)}
                t={t} lang={lang} onSelect={toggleSelect} onClick={setActiveRoom} />
            ))}
          </div>
        </div>
      ))}

      {activeRoom && (
        <RoomModal room={activeRoom} t={t} lang={lang} users={users}
          onClose={() => setActiveRoom(null)} onUpdated={() => { load(); setActiveRoom(null); }} />
      )}
      {showBulk && (
        <BulkModal selectedIds={selected} t={t} lang={lang} users={users} rooms={rooms}
          onClose={() => setShowBulk(false)} onDone={() => { load(); setSelected([]); }} />
      )}
    </div>
  );
}
