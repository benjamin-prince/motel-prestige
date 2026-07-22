"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Modal, StatCardGrid, EmptyState, SkeletonCards } from "@/components/ui";

const ITEM_STATUSES: Record<string, { tKey: string; color: string; bg: string; icon: string; gradient: string }> = {
  found:     { tKey: "lf_status_found",     color: "#3b82f6", bg: "#eff6ff", icon: "📦", gradient: "linear-gradient(135deg,#2563eb,#3b82f6)" },
  claimed:   { tKey: "lf_status_claimed",   color: "#22c55e", bg: "#f0fdf4", icon: "✅", gradient: "linear-gradient(135deg,#16a34a,#22c55e)" },
  donated:   { tKey: "lf_status_donated",   color: "#f59e0b", bg: "#fffbeb", icon: "🎁", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
  discarded: { tKey: "lf_status_discarded", color: "#6b7280", bg: "#f9fafb", icon: "🗑️", gradient: "linear-gradient(135deg,#4b5563,#6b7280)" },
};

function ItemModal({ item, t, users, rooms, onClose, onSaved }: {
  item: any | null; t: any; users: any[]; rooms: any[];
  onClose: () => void; onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState(item ? {
    item_description: item.item_description,
    found_location: item.found_location || "",
    found_date: item.found_date,
    found_by_staff_id: String(item.found_by_staff_id || ""),
    room_id: String(item.room_id || ""),
    guest_name: item.guest_name || "",
    guest_contact: item.guest_contact || "",
    storage_location: item.storage_location || "",
    notes: item.notes || "",
    status: item.status,
  } : { item_description: "", found_location: "", found_date: today, found_by_staff_id: "", room_id: "", guest_name: "", guest_contact: "", storage_location: "", notes: "", status: "found" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.item_description.trim()) { setErr(t.lf_item_description + " " + t.required); return; }
    if (!form.found_date) { setErr(t.lf_found_date + " " + t.required); return; }
    setSaving(true); setErr("");
    try {
      const data = {
        item_description: form.item_description,
        found_location: form.found_location || undefined,
        found_date: form.found_date,
        found_by_staff_id: form.found_by_staff_id ? Number(form.found_by_staff_id) : undefined,
        room_id: form.room_id ? Number(form.room_id) : undefined,
        guest_name: form.guest_name || undefined,
        guest_contact: form.guest_contact || undefined,
        storage_location: form.storage_location || undefined,
        notes: form.notes || undefined,
      };
      if (item) await api.updateLostFound(item.id, { ...data, status: form.status });
      else await api.createLostFound(data);
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal maxWidth="max-w-lg" title={item ? t.lf_edit_title : t.lf_log_title} onClose={onClose}>
      <div className="p-6 space-y-4">
        {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>}

        <div>
          <label className="field-label">{t.lf_item_description} *</label>
          <textarea value={form.item_description}
            onChange={e => setForm(f => ({ ...f, item_description: e.target.value }))}
            rows={2} className="field-input" style={{ resize: "none" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.lf_found_location}</label>
            <input value={form.found_location}
              onChange={e => setForm(f => ({ ...f, found_location: e.target.value }))} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t.lf_found_date} *</label>
            <input type="date" value={form.found_date}
              onChange={e => setForm(f => ({ ...f, found_date: e.target.value }))} className="field-input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.lf_found_by}</label>
            <select value={form.found_by_staff_id}
              onChange={e => setForm(f => ({ ...f, found_by_staff_id: e.target.value }))} className="field-input">
              <option value="">—</option>
              {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.room_col}</label>
            <select value={form.room_id}
              onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="field-input">
              <option value="">—</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.lf_guest_name}</label>
            <input value={form.guest_name}
              onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t.lf_guest_contact}</label>
            <input value={form.guest_contact}
              onChange={e => setForm(f => ({ ...f, guest_contact: e.target.value }))} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label">{t.lf_storage_location}</label>
          <input value={form.storage_location}
            onChange={e => setForm(f => ({ ...f, storage_location: e.target.value }))} className="field-input" />
        </div>
        <div>
          <label className="field-label">{t.notes}</label>
          <input value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="field-input" />
        </div>
        {item && (
          <div>
            <label className="field-label">{t.lf_status}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ITEM_STATUSES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, status: k }))}
                  className="py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={form.status === k
                    ? { borderColor: v.color, background: v.color + "18", color: v.color }
                    : { borderColor: "var(--border)", color: "var(--muted)" }}>
                  {v.icon} {(t as any)[v.tKey]}
                </button>
              ))}
            </div>
          </div>
        )}
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? t.loading : t.save}
        </button>
      </div>
    </Modal>
  );
}

export default function LostFoundPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"new" | any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [it, r, u] = await Promise.all([
        api.getLostFound(filterStatus !== "all" ? filterStatus : undefined),
        api.getRooms(), api.getUsersBasic(),
      ]);
      setItems(it); setRooms(r); setUsers(u);
    } finally { setLoading(false); }
  }, [filterStatus]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id: number, status: string) => {
    await api.updateLostFound(id, { status }); load();
  };
  const del = async (id: number) => {
    if (!confirm(t.lf_delete_confirm)) return;
    await api.deleteLostFound(id); load();
  };

  const filtered = search.trim()
    ? items.filter(i => i.item_description?.toLowerCase().includes(search.toLowerCase()) ||
        i.found_location?.toLowerCase().includes(search.toLowerCase()) ||
        i.guest_name?.toLowerCase().includes(search.toLowerCase()))
    : items;

  const kpiCounts = Object.fromEntries(Object.keys(ITEM_STATUSES).map(k => [k, items.filter(i => i.status === k).length]));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t.lf_title}</h1>
          <p className="page-subtitle">
            {items.filter(i => i.status === "found").length} {t.lf_active} · {items.length} {t.total?.toLowerCase() || "total"}
          </p>
        </div>
        <button onClick={() => setModal("new")} className="btn-primary">+ {t.lf_new_item}</button>
      </div>

      {/* Gradient KPI cards */}
      <StatCardGrid loading={loading} className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        stats={Object.entries(ITEM_STATUSES).map(([k, v]) => ({
          label: (t as any)[v.tKey], value: kpiCounts[k] || 0, icon: v.icon, gradient: v.gradient,
        }))} />

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.lf_search}
            className="field-input pl-9" style={{ marginTop: 0 }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterStatus("all")}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border"
            style={filterStatus === "all" ? { borderColor: "#3b82f6", background: "#eff6ff", color: "#3b82f6" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
            {t.all} ({items.length})
          </button>
          {Object.entries(ITEM_STATUSES).map(([k, v]) => (
            <button key={k} onClick={() => setFilterStatus(filterStatus === k ? "all" : k)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={filterStatus === k
                ? { borderColor: v.color, background: v.bg, color: v.color }
                : { borderColor: "var(--border)", color: "var(--muted)" }}>
              {v.icon} {(t as any)[v.tKey]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonCards count={4} height={72} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔎" message={t.lf_no_items} className="card flex flex-col items-center justify-center py-12" />
      ) : (
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          {filtered.map((item, i) => {
            const st = ITEM_STATUSES[item.status] ?? ITEM_STATUSES.found;
            return (
              <div key={item.id}
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  background: i % 2 === 0 ? "#fff" : "var(--input-bg)",
                  borderLeft: `3px solid ${st.color}` }}>
                <span className="text-2xl shrink-0 mt-0.5">{st.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm" style={{ color: "var(--text)" }}>{item.item_description}</p>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: st.bg, color: st.color }}>
                      {(t as any)[st.tKey]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {item.found_date && <span>📅 {new Date(item.found_date + "T00:00:00").toLocaleDateString()}</span>}
                    {item.found_location && <span>📍 {item.found_location}</span>}
                    {item.room_number && <span>🛏 {t.room_col} {item.room_number}</span>}
                    {item.found_by_name && <span>👤 {item.found_by_name}</span>}
                    {item.storage_location && <span>🗄️ {item.storage_location}</span>}
                    {item.guest_name && <span>🧳 {item.guest_name}{item.guest_contact && ` · ${item.guest_contact}`}</span>}
                  </div>
                  {item.notes && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>📝 {item.notes}</p>}
                  {item.status === "found" && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => resolve(item.id, "claimed")}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                        style={{ borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
                        ✅ {t.lf_mark_claimed}
                      </button>
                      <button onClick={() => resolve(item.id, "donated")}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                        style={{ borderColor: "#f59e0b", color: "#d97706", background: "#fffbeb" }}>
                        🎁 {t.lf_mark_donated}
                      </button>
                      <button onClick={() => resolve(item.id, "discarded")}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                        style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                        🗑️ {t.lf_mark_discarded}
                      </button>
                    </div>
                  )}
                  {item.status !== "found" && item.resolved_at && (
                    <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {t.lf_resolved}: {new Date(item.resolved_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setModal(item)} className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✏️</button>
                  <button onClick={() => del(item.id)} className="text-xs px-2 py-1 rounded border"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "new" && (
        <ItemModal item={null} t={t} users={users} rooms={rooms} onClose={() => setModal(null)} onSaved={load} />
      )}
      {modal && modal !== "new" && (
        <ItemModal item={modal} t={t} users={users} rooms={rooms} onClose={() => setModal(null)} onSaved={load} />
      )}
    </div>
  );
}
