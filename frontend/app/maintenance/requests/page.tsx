"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Modal, EmptyState, SkeletonCards } from "@/components/ui";
import { usePermissions } from "@/lib/permissions";

const CATEGORIES: Record<string, { tKey: string; icon: string; color: string }> = {
  plumbing:   { tKey: "wo_cat_plumbing",   icon: "🚿", color: "#0891b2" },
  electrical: { tKey: "wo_cat_electrical", icon: "⚡", color: "#f59e0b" },
  hvac:       { tKey: "wo_cat_hvac",       icon: "❄️", color: "#3b82f6" },
  carpentry:  { tKey: "wo_cat_carpentry",  icon: "🪚", color: "#92400e" },
  furniture:  { tKey: "wo_cat_furniture",  icon: "🪑", color: "#7c3aed" },
  general:    { tKey: "wo_cat_general",    icon: "🔧", color: "#6b7280" },
};
const PRIORITIES: Record<string, { tKey: string; color: string; bg: string }> = {
  low:    { tKey: "wo_pri_low",    color: "#22c55e", bg: "#f0fdf4" },
  medium: { tKey: "wo_pri_medium", color: "#f59e0b", bg: "#fffbeb" },
  high:   { tKey: "wo_pri_high",   color: "#ef4444", bg: "#fef2f2" },
  urgent: { tKey: "wo_pri_urgent", color: "#dc2626", bg: "#fff1f2" },
};
const STATUSES: Record<string, { tKey: string; color: string; bg: string; dot: string; gradient: string }> = {
  open:        { tKey: "wo_status_open",        color: "#ef4444", bg: "#fef2f2", dot: "#dc2626", gradient: "linear-gradient(135deg,#dc2626,#ef4444)" },
  in_progress: { tKey: "wo_status_in_progress", color: "#f59e0b", bg: "#fffbeb", dot: "#d97706", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
  on_hold:     { tKey: "wo_status_on_hold",     color: "#8b5cf6", bg: "#f5f3ff", dot: "#7c3aed", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
  done:        { tKey: "wo_status_done",        color: "#22c55e", bg: "#f0fdf4", dot: "#16a34a", gradient: "linear-gradient(135deg,#16a34a,#22c55e)" },
  cancelled:   { tKey: "wo_status_cancelled",   color: "#6b7280", bg: "#f9fafb", dot: "#4b5563", gradient: "linear-gradient(135deg,#4b5563,#6b7280)" },
};

function age(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d`;
  if (h > 0) return `${h}h`;
  return "< 1h";
}

function WOCard({ wo, t, users, onUpdated }: { wo: any; t: any; users: any[]; onUpdated: () => void }) {
  const { can } = usePermissions();
  const canWork = can(["maint.edit", "maint.close"]);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES[wo.category] ?? CATEGORIES.general;
  const pri = PRIORITIES[wo.priority] ?? PRIORITIES.medium;
  const st = STATUSES[wo.status] ?? STATUSES.open;

  const setStatus = async (status: string, extra?: any) => {
    setSaving(true);
    try { await api.updateMaintenanceRequest(wo.id, { status, ...extra }); onUpdated(); }
    finally { setSaving(false); }
  };
  const del = async () => {
    if (!confirm(t.wo_delete_confirm)) return;
    await api.deleteMaintenanceRequest(wo.id); onUpdated();
  };

  return (
    <div className="card transition-all hover:shadow-md" style={{ padding: 0, overflow: "hidden" }}>
      <div className="h-1" style={{ background: pri.color }} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ background: cat.color + "15" }}>
              {cat.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{wo.title}</span>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>#{wo.id}</span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs" style={{ color: "var(--muted)" }}>
                <span style={{ color: cat.color }}>{(t as any)[cat.tKey]}</span>
                {wo.room_number && <span>🛏 {t.room_col} {wo.room_number}</span>}
                {wo.location_description && !wo.room_number && <span>📍 {wo.location_description}</span>}
                <span>🕐 {age(wo.created_at)}</span>
                {wo.reporter_name && <span>👤 {wo.reporter_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: pri.bg, color: pri.color }}>
              {(t as any)[pri.tKey]}
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.color }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
              {(t as any)[st.tKey]}
            </span>
            <button onClick={() => setExpanded(e => !e)}
              className="w-7 h-7 rounded-lg border flex items-center justify-center"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              {expanded ? "▲" : "▼"}
            </button>
            {can("maint.delete") && (
              <button onClick={del}
                className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✕</button>
            )}
          </div>
        </div>

        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {wo.assignee_name
            ? <span>🔧 {t.wo_assignee}: <strong style={{ color: "var(--text)" }}>{wo.assignee_name}</strong></span>
            : <span style={{ color: "#f59e0b" }}>⚠️ {t.wo_unassigned}</span>
          }
        </div>

        {expanded && (
          <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
            {wo.description && <p className="text-sm" style={{ color: "var(--text)", lineHeight: 1.6 }}>{wo.description}</p>}
            {wo.resolution_notes && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "#f0fdf4", color: "#166534" }}>
                ✅ {t.wo_resolution_label}: {wo.resolution_notes}
              </div>
            )}
            {wo.started_at && <p className="text-xs" style={{ color: "var(--muted)" }}>▶ {t.wo_started_label}: {new Date(wo.started_at).toLocaleString()}</p>}
            {wo.completed_at && <p className="text-xs" style={{ color: "var(--muted)" }}>✓ {t.wo_completed_label}: {new Date(wo.completed_at).toLocaleString()}</p>}
          </div>
        )}

        {canWork && wo.status !== "done" && wo.status !== "cancelled" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {wo.status === "open" && (
              <button onClick={() => setStatus("in_progress")} disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                style={{ borderColor: "#f59e0b", color: "#d97706", background: "#fffbeb" }}>
                ▶ {t.wo_start_work}
              </button>
            )}
            {wo.status === "in_progress" && (
              <>
                <button onClick={() => setStatus("on_hold")} disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: "#8b5cf6", color: "#7c3aed", background: "#f5f3ff" }}>
                  ⏸ {t.wo_on_hold}
                </button>
                <CloseButton t={t} onClose={notes => setStatus("done", { resolution_notes: notes || undefined })} />
              </>
            )}
            {wo.status === "on_hold" && (
              <>
                <button onClick={() => setStatus("in_progress")} disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                  style={{ borderColor: "#f59e0b", color: "#d97706", background: "#fffbeb" }}>
                  ▶ {t.wo_resume}
                </button>
                <CloseButton t={t} onClose={notes => setStatus("done", { resolution_notes: notes || undefined })} />
              </>
            )}
            {(wo.status === "open" || wo.status === "in_progress" || wo.status === "on_hold") && (
              <button onClick={() => setStatus("cancelled")} disabled={saving}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                ✕ {t.cancel}
              </button>
            )}
          </div>
        )}
        {canWork && (wo.status === "done" || wo.status === "cancelled") && (
          <button onClick={() => setStatus("open")} disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            ↺ {t.wo_reopen}
          </button>
        )}
      </div>
    </div>
  );
}

function CloseButton({ t, onClose }: { t: any; onClose: (notes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  if (!open) return (
    <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
      style={{ borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
      ✓ {t.wo_close}
    </button>
  );
  return (
    <div className="flex gap-2 w-full mt-1">
      <input value={notes} onChange={e => setNotes(e.target.value)}
        placeholder={t.wo_resolve_hint} className="field-input flex-1" style={{ marginTop: 0 }} />
      <button onClick={() => { onClose(notes); setOpen(false); }}
        className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
        style={{ borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
        ✓ {t.wo_confirm}
      </button>
    </div>
  );
}

function NewWOModal({ t, users, rooms, onClose, onCreated }: {
  t: any; users: any[]; rooms: any[]; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", room_id: "", location_description: "", category: "general", priority: "medium", description: "", assigned_to: "", reported_by: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.title.trim()) { setErr(t.wo_title + " required"); return; }
    setSaving(true); setErr("");
    try {
      await api.createMaintenanceRequest({
        title: form.title,
        room_id: form.room_id ? Number(form.room_id) : undefined,
        location_description: form.location_description || undefined,
        category: form.category, priority: form.priority,
        description: form.description || undefined,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
        reported_by: form.reported_by ? Number(form.reported_by) : undefined,
      });
      onCreated(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal maxWidth="max-w-lg" title={t.new_work_order} onClose={onClose}>
      <div className="p-6 space-y-4">
        {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>}
        <div>
          <label className="field-label">{t.wo_title} *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="field-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.wo_category}</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="field-input">
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {(t as any)[v.tKey]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">{t.type}</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="field-input">
              {Object.entries(PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>{(t as any)[v.tKey]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.room_col}</label>
            <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="field-input">
              <option value="">— {t.wo_no_room} —</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.wo_location}</label>
            <input value={form.location_description}
              onChange={e => setForm(f => ({ ...f, location_description: e.target.value }))} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label">{t.wo_description}</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3} className="field-input" style={{ resize: "none" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.wo_assignee}</label>
            <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="field-input">
              <option value="">— {t.wo_unassigned} —</option>
              {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.wo_reporter}</label>
            <select value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} className="field-input">
              <option value="">—</option>
              {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? t.loading : t.new_work_order}
        </button>
      </div>
    </Modal>
  );
}

export default function MaintenanceRequestsPage() {
  const { t } = useI18n();
  const { can } = usePermissions();
  const [requests, setRequests] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterStaff !== "all") params.set("assigned_to", filterStaff);
      const [r, rm, u] = await Promise.all([api.getMaintenanceRequests(params.toString()), api.getRooms(), api.getUsersBasic()]);
      setRequests(r); setRooms(rm); setUsers(u);
    } finally { setLoading(false); }
  }, [filterStatus, filterPriority, filterCategory, filterStaff]);
  useEffect(() => { load(); }, [load]);

  const open = requests.filter(r => r.status === "open").length;
  const inProg = requests.filter(r => r.status === "in_progress").length;
  const urgent = requests.filter(r => r.priority === "urgent" && r.status !== "done" && r.status !== "cancelled").length;

  const filtered = search.trim()
    ? requests.filter(r => r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.room_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.assignee_name?.toLowerCase().includes(search.toLowerCase()))
    : requests;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t.work_orders}</h1>
          <p className="page-subtitle">
            {open} {(t.wo_status_open).toLowerCase()} · {inProg} {(t.wo_status_in_progress).toLowerCase()}
            {urgent > 0 && <span style={{ color: "#dc2626" }}> · ⚠️ {urgent} {(t.wo_pri_urgent).toLowerCase()}</span>}
          </p>
        </div>
        {can("maint.create") && (
          <button onClick={() => setShowNew(true)} className="btn-primary">+ {t.new_work_order}</button>
        )}
      </div>

      {/* Gradient KPI status cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUSES).map(([k, v]) => {
          const count = requests.filter(r => r.status === k).length;
          const active = filterStatus === k;
          return (
            <button key={k} onClick={() => setFilterStatus(active ? "all" : k)}
              className="relative overflow-hidden rounded-xl p-4 text-left transition-all hover:opacity-90 border-2"
              style={active
                ? { background: v.gradient, border: "none", boxShadow: `0 4px 14px ${v.color}40` }
                : { background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: active ? "rgba(255,255,255,0.7)" : v.dot }} />
                <span className="text-xs font-semibold" style={{ color: active ? "rgba(255,255,255,0.9)" : v.color }}>
                  {(t as any)[v.tKey]}
                </span>
              </div>
              <div className="text-2xl font-black" style={{ color: active ? "#fff" : v.color }}>{count}</div>
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="card flex flex-wrap gap-3 items-center" style={{ padding: "12px 16px" }}>
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--muted)" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.wo_search} className="field-input pl-9" style={{ marginTop: 0 }} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["all", ...Object.keys(PRIORITIES)].map(k => {
            const p = k === "all" ? null : PRIORITIES[k];
            const active = filterPriority === k;
            return (
              <button key={k} onClick={() => setFilterPriority(k)}
                className="px-2 py-1 rounded-lg text-xs font-semibold border transition-all"
                style={active
                  ? { borderColor: p?.color ?? "#3b82f6", background: (p?.bg ?? "#eff6ff"), color: p?.color ?? "#3b82f6" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {k === "all" ? t.all : (t as any)[p!.tKey]}
              </button>
            );
          })}
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="field-input" style={{ width: "auto", marginTop: 0, paddingTop: 4, paddingBottom: 4 }}>
          <option value="all">{t.all}</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {(t as any)[v.tKey]}</option>
          ))}
        </select>
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
          className="field-input" style={{ width: "auto", marginTop: 0, paddingTop: 4, paddingBottom: 4 }}>
          <option value="all">{t.wo_all_staff}</option>
          {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonCards count={4} height={84} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔧" message={t.wo_no_orders} className="card flex flex-col items-center justify-center py-12" />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => <WOCard key={r.id} wo={r} t={t} users={users} onUpdated={load} />)}
        </div>
      )}

      {showNew && (
        <NewWOModal t={t} users={users} rooms={rooms} onClose={() => setShowNew(false)} onCreated={load} />
      )}
    </div>
  );
}
