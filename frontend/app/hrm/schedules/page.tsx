"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Modal, EmptyState, SkeletonCards } from "@/components/ui";
import { usePermissions } from "@/lib/permissions";

type Shift = {
  id: number;
  user_id: number;
  staff_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_label: string | null;
  notes: string | null;
};
type BasicUser = { id: number; full_name: string; role: string };

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const mondayOf = (d: Date) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
  return c;
};
const addDays = (d: Date, n: number) => {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
};

type FormState = {
  id: number | null;
  user_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role_label: string;
  notes: string;
};

function ShiftModal({
  L,
  users,
  initial,
  onClose,
  onSaved,
}: {
  L: (en: string, fr: string) => string;
  users: BasicUser[];
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isEdit = form.id != null;
  const set = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.user_id) { setErr(L("Please choose a staff member", "Veuillez choisir un employé")); return; }
    if (!form.shift_date) { setErr(L("Please choose a date", "Veuillez choisir une date")); return; }
    setSaving(true); setErr("");
    const payload = {
      user_id: Number(form.user_id),
      shift_date: form.shift_date,
      start_time: form.start_time,
      end_time: form.end_time,
      role_label: form.role_label || null,
      notes: form.notes || null,
    };
    try {
      if (isEdit && form.id != null) await api.updateShift(form.id, payload);
      else await api.createShift(payload);
      onSaved(); onClose();
    } catch (e: any) { setErr(e?.message || L("Something went wrong", "Une erreur est survenue")); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isEdit ? L("Edit Shift", "Modifier l'Horaire") : L("New Shift", "Nouvel Horaire")} onClose={onClose}>
      <div className="p-6 space-y-4">
        {err && (
          <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{err}</div>
        )}
        <div>
          <label className="field-label">{L("Staff member", "Employé")} *</label>
          <select value={form.user_id} onChange={e => set("user_id", e.target.value)} className="field-input">
            <option value="">— {L("Select staff", "Choisir un employé")} —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}{u.role ? ` (${u.role})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">{L("Date", "Date")} *</label>
          <input type="date" value={form.shift_date} onChange={e => set("shift_date", e.target.value)} className="field-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">{L("Start", "Début")}</label>
            <input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">{L("End", "Fin")}</label>
            <input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} className="field-input" />
          </div>
        </div>
        <div>
          <label className="field-label">{L("Role / Post", "Poste")}</label>
          <input value={form.role_label} onChange={e => set("role_label", e.target.value)} className="field-input"
            placeholder={L("e.g. Front desk", "ex. Réception")} />
        </div>
        <div>
          <label className="field-label">{L("Notes", "Notes")}</label>
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)} className="field-input" rows={2}
            placeholder={L("Optional", "Optionnel")} />
        </div>
        <button onClick={submit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.6 : 1 }}>
          {saving ? "…" : isEdit ? L("Save changes", "Enregistrer") : L("Add shift", "Ajouter l'horaire")}
        </button>
      </div>
    </Modal>
  );
}

export default function SchedulesPage() {
  const { lang } = useI18n();
  const { can } = usePermissions();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const canManage = can("hrm.schedules");
  const locale = lang === "fr" ? "fr-FR" : "en-US";

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<BasicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<FormState | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekEnd = days[6];
  const todayIso = iso(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        api.getShifts({ date_from: iso(weekStart), date_to: iso(addDays(weekStart, 6)) }),
        api.getUsersBasic(),
      ]);
      setShifts(s); setUsers(u);
    } finally { setLoading(false); }
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  const shiftsByDate = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of shifts) (map[s.shift_date] ||= []).push(s);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [shifts]);

  const del = async (s: Shift) => {
    if (!confirm(L("Delete this shift?", "Supprimer cet horaire ?"))) return;
    await api.deleteShift(s.id);
    load();
  };

  const openNew = (date: string) => setModal({
    id: null, user_id: "", shift_date: date, start_time: "09:00", end_time: "17:00", role_label: "", notes: "",
  });
  const openEdit = (s: Shift) => setModal({
    id: s.id, user_id: String(s.user_id), shift_date: s.shift_date,
    start_time: s.start_time, end_time: s.end_time, role_label: s.role_label || "", notes: s.notes || "",
  });

  const rangeLabel = `${weekStart.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {L("Staff Schedules", "Horaires du Personnel")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Plan work shifts across the week", "Planifiez les quarts de travail de la semaine")}
          </p>
        </div>
      </div>

      {/* Week navigator */}
      <div className="card flex items-center gap-3 flex-wrap" style={{ padding: "12px 16px" }}>
        <button onClick={() => setWeekStart(w => addDays(w, -7))}
          className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text)" }} aria-label={L("Previous week", "Semaine précédente")}>‹</button>
        <div className="flex-1 text-center font-semibold text-sm" style={{ color: "var(--text)", minWidth: 160 }}>
          {rangeLabel}
        </div>
        <button onClick={() => setWeekStart(w => addDays(w, 7))}
          className="w-8 h-8 rounded-lg border flex items-center justify-center text-lg font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text)" }} aria-label={L("Next week", "Semaine suivante")}>›</button>
        <button onClick={() => setWeekStart(mondayOf(new Date()))}
          className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
          style={{ borderColor: "var(--blue)", color: "var(--blue)" }}>
          {L("This week", "Cette semaine")}
        </button>
      </div>

      {loading ? (
        <SkeletonCards count={7} height={120} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map(d => {
            const dIso = iso(d);
            const isToday = dIso === todayIso;
            const dayShifts = shiftsByDate[dIso] || [];
            return (
              <div key={dIso} className="card" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="flex items-center justify-between" style={{
                  paddingBottom: 6, borderBottom: "1px solid var(--border)",
                }}>
                  <span className="text-xs font-bold" style={{ color: isToday ? "var(--blue)" : "var(--text)" }}>
                    {d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  {isToday && (
                    <span className="pill" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                      {L("Today", "Auj.")}
                    </span>
                  )}
                </div>

                {dayShifts.length === 0 ? (
                  <div className="text-xs text-center py-3" style={{ color: "var(--muted)" }}>
                    {L("No shifts", "Aucun quart")}
                  </div>
                ) : (
                  dayShifts.map(s => (
                    <div key={s.id} className="rounded-lg border" style={{
                      borderColor: "var(--border)", background: "var(--input-bg)", padding: "8px 10px",
                    }}>
                      <div className="flex items-start justify-between gap-1">
                        <button onClick={() => canManage && openEdit(s)}
                          className="text-left flex-1 min-w-0"
                          style={{ cursor: canManage ? "pointer" : "default" }}>
                          <div className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{s.staff_name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                            {s.start_time} – {s.end_time}
                          </div>
                        </button>
                        {canManage && (
                          <button onClick={() => del(s)} aria-label={L("Delete", "Supprimer")}
                            className="text-xs px-1.5 rounded" style={{ color: "var(--muted)" }}>✕</button>
                        )}
                      </div>
                      {s.role_label && (
                        <span className="pill mt-1" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                          {s.role_label}
                        </span>
                      )}
                      {s.notes && (
                        <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>📝 {s.notes}</div>
                      )}
                    </div>
                  ))
                )}

                {canManage && (
                  <button onClick={() => openNew(dIso)}
                    className="text-xs font-semibold rounded-lg border mt-auto"
                    style={{ borderColor: "var(--border)", color: "var(--blue)", padding: "6px 0" }}>
                    + {L("Add", "Ajouter")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && shifts.length === 0 && !canManage && (
        <EmptyState icon="🗓️" message={L("No shifts scheduled this week", "Aucun quart planifié cette semaine")}
          className="card flex flex-col items-center justify-center py-12" />
      )}

      {modal && (
        <ShiftModal L={L} users={users} initial={modal} onClose={() => setModal(null)} onSaved={load} />
      )}
    </div>
  );
}
