"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Modal, StatCardGrid, EmptyState, SkeletonCards } from "@/components/ui";

const TASK_TYPES: Record<string, { tKey: string; icon: string }> = {
  cleaning:   { tKey: "task_type_cleaning",   icon: "🧹" },
  turndown:   { tKey: "task_type_turndown",   icon: "🛏️" },
  deep_clean: { tKey: "task_type_deep_clean", icon: "✨" },
  inspection: { tKey: "task_type_inspection", icon: "🔍" },
};
const PRIORITIES: Record<string, { tKey: string; color: string }> = {
  normal:   { tKey: "priority_normal",   color: "#6b7280" },
  priority: { tKey: "priority_priority", color: "#f59e0b" },
  urgent:   { tKey: "priority_urgent",   color: "#ef4444" },
};
const STATUSES: Record<string, { tKey: string; color: string; bg: string }> = {
  pending:     { tKey: "task_pending",     color: "#6b7280", bg: "#f9fafb" },
  in_progress: { tKey: "task_in_progress", color: "#f59e0b", bg: "#fffbeb" },
  done:        { tKey: "task_done",        color: "#22c55e", bg: "#f0fdf4" },
  skipped:     { tKey: "task_skipped",     color: "#8b5cf6", bg: "#f5f3ff" },
};

const KPI_GRADIENTS = ["linear-gradient(135deg,#6b7280,#9ca3af)","linear-gradient(135deg,#d97706,#f59e0b)","linear-gradient(135deg,#16a34a,#22c55e)","linear-gradient(135deg,#7c3aed,#8b5cf6)"];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function TaskCard({ task, t, users, onUpdated }: { task: any; t: any; users: any[]; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [assignee, setAssignee] = useState(String(task.assigned_to || ""));
  const st = STATUSES[task.status] ?? STATUSES.pending;
  const pr = PRIORITIES[task.priority] ?? PRIORITIES.normal;
  const tt = TASK_TYPES[task.task_type] ?? { icon: "📋", tKey: "task_type_cleaning" };

  const setStatus = async (status: string) => {
    setSaving(true);
    try { await api.updateHKTask(task.id, { status }); onUpdated(); }
    finally { setSaving(false); }
  };
  const saveAssignee = async () => {
    setSaving(true);
    try { await api.updateHKTask(task.id, { assigned_to: assignee ? Number(assignee) : null }); setEditing(false); onUpdated(); }
    finally { setSaving(false); }
  };
  const del = async () => {
    if (!confirm((t as any).lf_delete_confirm || "Delete?")) return;
    await api.deleteHKTask(task.id); onUpdated();
  };

  return (
    <div className="card" style={{ padding: "14px 16px", borderLeft: `4px solid ${pr.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tt.icon}</span>
          <div>
            <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
              {(t as any)[tt.tKey]}
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>#{task.id}</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {t.room_col} <strong style={{ color: "var(--text)" }}>{task.room_number}</strong>
              {task.floor !== undefined && <span> · {t.floor_label} {task.floor}</span>}
              {task.room_type && <span> · {task.room_type}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: pr.color + "18", color: pr.color }}>
            {(t as any)[pr.tKey]}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
            {(t as any)[st.tKey]}
          </span>
          <button onClick={del} className="text-xs px-2 py-1 rounded border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✕</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center text-xs mt-2" style={{ color: "var(--muted)" }}>
        <span>📅 {fmtDate(task.scheduled_date)}</span>
        {task.assignee_name ? (
          <span className="flex items-center gap-1">
            👤 {task.assignee_name}
            <button onClick={() => setEditing(e => !e)} className="underline" style={{ color: "#3b82f6" }}>
              {t.hk_change_assignee}
            </button>
          </span>
        ) : (
          <button onClick={() => setEditing(e => !e)} className="underline" style={{ color: "#f59e0b" }}>
            + {t.hk_assign_staff_btn}
          </button>
        )}
        {task.notes && <span>📝 {task.notes}</span>}
        {task.completed_at && <span>✅ {new Date(task.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>

      {editing && (
        <div className="flex gap-2 items-center mt-2">
          <select value={assignee} onChange={e => setAssignee(e.target.value)} className="field-input" style={{ flex: 1, marginTop: 0 }}>
            <option value="">— {t.hk_unassigned} —</option>
            {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <button onClick={saveAssignee} disabled={saving} className="btn-primary text-xs px-3 py-2">{t.save}</button>
          <button onClick={() => setEditing(false)} className="btn-secondary text-xs px-3 py-2">{t.cancel}</button>
        </div>
      )}

      {task.status !== "done" && task.status !== "skipped" && (
        <div className="flex gap-2 pt-2">
          {task.status === "pending" && (
            <button onClick={() => setStatus("in_progress")} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
              style={{ borderColor: "#f59e0b", color: "#d97706", background: "#fffbeb" }}>
              ▶ {t.hk_start_task}
            </button>
          )}
          {(task.status === "pending" || task.status === "in_progress") && (
            <button onClick={() => setStatus("done")} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
              style={{ borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
              ✓ {t.hk_mark_done}
            </button>
          )}
          {task.status === "pending" && (
            <button onClick={() => setStatus("skipped")} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold border"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
              ↷ {t.hk_skip_task}
            </button>
          )}
        </div>
      )}
      {(task.status === "done" || task.status === "skipped") && (
        <button onClick={() => setStatus("pending")} disabled={saving}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold border mt-2"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          ↺ {t.hk_reopen_task}
        </button>
      )}
    </div>
  );
}

function NewTaskModal({ t, users, rooms, onClose, onCreated }: { t: any; users: any[]; rooms: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ room_id: "", task_type: "cleaning", priority: "normal", assigned_to: "", scheduled_date: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.room_id) { setErr(t.select_room); return; }
    setSaving(true); setErr("");
    try {
      await api.createHKTask({ room_id: Number(form.room_id), task_type: form.task_type, priority: form.priority,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : undefined,
        scheduled_date: form.scheduled_date, notes: form.notes || undefined });
      onCreated(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={t.new_task} onClose={onClose}>
      <div className="p-6 space-y-4">
        {err && <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>}
        <div>
          <label className="field-label">{t.room_col} *</label>
          <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className="field-input">
            <option value="">— {t.select_room} —</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.room_number} — {r.room_type} ({t.floor_label} {r.floor})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{t.task_type}</label>
            <select value={form.task_type} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} className="field-input">
              {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{(t as any)[v.tKey]}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.type}</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="field-input">
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{(t as any)[v.tKey]}</option>)}
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
        <div>
          <label className="field-label">{t.notes}</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="field-input" />
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? t.loading : t.create_task}
        </button>
      </div>
    </Modal>
  );
}

export default function HousekeepingTasksPage() {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scheduled_date", date);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterStaff !== "all") params.set("assigned_to", filterStaff);
      const [ts, r, u] = await Promise.all([api.getHKTasks(params.toString()), api.getHKRooms(), api.getUsersBasic()]);
      setTasks(ts); setRooms(r); setUsers(u);
    } finally { setLoading(false); }
  }, [date, filterStatus, filterStaff]);
  useEffect(() => { load(); }, [load]);

  const counts = {
    pending: tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
    skipped: tasks.filter(t => t.status === "skipped").length,
  };

  const dateNav = (offset: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  };

  const kpis = [
    { label: t.task_pending,     value: counts.pending,     gradient: KPI_GRADIENTS[0] },
    { label: t.task_in_progress, value: counts.in_progress, gradient: KPI_GRADIENTS[1] },
    { label: t.task_done,        value: counts.done,        gradient: KPI_GRADIENTS[2] },
    { label: t.task_skipped,     value: counts.skipped,     gradient: KPI_GRADIENTS[3] },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t.nav_task_list}</h1>
          <p className="page-subtitle">{tasks.length} {t.task_pending.toLowerCase()} {counts.pending} · {t.task_in_progress.toLowerCase()} {counts.in_progress} · {t.task_done.toLowerCase()} {counts.done}</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">+ {t.new_task}</button>
      </div>

      {/* KPI gradient cards */}
      <StatCardGrid stats={kpis} loading={loading} className="grid grid-cols-2 sm:grid-cols-4 gap-4" />

      {/* Date navigator */}
      <div className="card flex items-center gap-4" style={{ padding: "12px 16px" }}>
        <button onClick={() => dateNav(-1)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}>‹</button>
        <div className="flex-1 text-center">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="font-semibold text-sm bg-transparent border-none outline-none text-center"
            style={{ color: "var(--text)" }} />
        </div>
        <button onClick={() => dateNav(1)} className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}>›</button>
        <button onClick={() => setDate(new Date().toISOString().split("T")[0])}
          className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
          style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
          {t.today}
        </button>
      </div>

      {/* Status filter chips + staff filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setFilterStatus("all")}
          className="px-3 py-1.5 rounded-full text-xs font-semibold border"
          style={filterStatus === "all" ? { borderColor: "#3b82f6", background: "#eff6ff", color: "#3b82f6" } : { borderColor: "var(--border)", color: "var(--muted)" }}>
          {t.all} ({tasks.length})
        </button>
        {Object.entries(STATUSES).map(([k, v]) => (
          <button key={k} onClick={() => setFilterStatus(filterStatus === k ? "all" : k)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={filterStatus === k
              ? { borderColor: v.color, background: v.bg, color: v.color }
              : { borderColor: "var(--border)", color: "var(--muted)" }}>
            {(t as any)[v.tKey]} ({tasks.filter(ts => ts.status === k).length})
          </button>
        ))}
        <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
          className="field-input ml-auto" style={{ width: "auto", marginTop: 0, paddingTop: 4, paddingBottom: 4 }}>
          <option value="all">{t.hk_all_staff}</option>
          {users.filter(u => u.is_active).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <SkeletonCards count={4} height={80} />
      ) : tasks.length === 0 ? (
        <EmptyState icon="✅" message={t.hk_no_tasks} className="card flex flex-col items-center justify-center py-12" />
      ) : (
        <div className="space-y-3">
          {tasks.map(task => <TaskCard key={task.id} task={task} t={t} users={users} onUpdated={load} />)}
        </div>
      )}

      {showNew && <NewTaskModal t={t} users={users} rooms={rooms} onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
