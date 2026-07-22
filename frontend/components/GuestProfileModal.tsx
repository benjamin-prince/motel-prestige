"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Modal, useToast } from "@/components/ui";
import type { Guest } from "@/lib/types";

// Quick guest profile: view details anywhere a guest is shown, and update
// them in place (gated by guests.edit) without leaving the current screen.
export default function GuestProfileModal({ guest, onClose, onSaved }: {
  guest: Guest;
  onClose: () => void;
  onSaved?: (g: Guest) => void;
}) {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const { toast } = useToast();
  const canEdit = can("guests.edit");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [idTypes, setIdTypes] = useState<any[]>([]);
  const [form, setForm] = useState({
    first_name: guest.first_name || "", last_name: guest.last_name || "",
    email: guest.email || "", phone: guest.phone || "",
    nationality: guest.nationality || "", date_of_birth: guest.date_of_birth || "",
    id_type: guest.id_type || "", id_number: guest.id_number || "",
    id_expiry_date: guest.id_expiry_date || "",
    address: guest.address || "", notes: guest.notes || "",
  });

  useEffect(() => { api.getLookup("id_type").then(setIdTypes).catch(() => {}); }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setErr(t.required_field);
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = typeof v === "string" && v.trim() === "" ? null : v;
      }
      // Backend update ignores nulls (exclude_none) — send only filled values.
      const updated = await api.updateGuest(guest.id, Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== null)
      ));
      toast(t.saved, "success");
      onSaved?.(updated);
      setEditing(false);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d?: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const ViewRow = ({ label, value }: { label: string; value?: React.ReactNode }) => (
    <div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-sm font-medium mt-0.5" style={{ color: "var(--text)" }}>{value || "—"}</div>
    </div>
  );

  return (
    <Modal title={`${guest.first_name} ${guest.last_name}`} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-6">
        {/* Identity header */}
        <div className="flex items-center gap-3 mb-5">
          <span className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold shrink-0"
            style={{ background: "#7c3aed" }}>
            {guest.first_name[0]}{guest.last_name[0]}
          </span>
          <div className="min-w-0">
            <div className="font-bold text-base" style={{ color: "var(--text)" }}>
              {guest.first_name} {guest.last_name}
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {guest.email}{guest.created_at ? ` · ${fmtDate(guest.created_at.slice(0, 10))}` : ""}
            </div>
          </div>
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)}
              className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shrink-0">
              {t.edit}
            </button>
          )}
        </div>

        {err && (
          <div className="rounded-lg px-4 py-2.5 text-sm mb-4" style={{ background: "#fce4ec", color: "#b71c1c" }}>{err}</div>
        )}

        {!editing ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <ViewRow label={t.phone} value={guest.phone} />
            <ViewRow label={t.nationality} value={guest.nationality} />
            <ViewRow label={t.dob} value={guest.date_of_birth ? fmtDate(guest.date_of_birth) : undefined} />
            <ViewRow label={`${t.id_type} / ${t.id_number}`}
              value={guest.id_type || guest.id_number ? `${guest.id_type || "—"} · ${guest.id_number || "—"}` : undefined} />
            <ViewRow label={t.expiry_date}
              value={guest.id_expiry_date ? (
                <span style={guest.id_expiry_date < new Date().toISOString().slice(0, 10) ? { color: "#c0392b" } : undefined}>
                  {fmtDate(guest.id_expiry_date)}
                </span>
              ) : undefined} />
            <div className="col-span-2"><ViewRow label={t.address} value={guest.address} /></div>
            <div className="col-span-2"><ViewRow label={t.notes} value={guest.notes} /></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label">{t.first_name} *</label>
                <input value={form.first_name} onChange={set("first_name")} className="field-input" /></div>
              <div><label className="field-label">{t.last_name} *</label>
                <input value={form.last_name} onChange={set("last_name")} className="field-input" /></div>
              <div><label className="field-label">{t.email} *</label>
                <input type="email" value={form.email} onChange={set("email")} className="field-input" /></div>
              <div><label className="field-label">{t.phone}</label>
                <input value={form.phone} onChange={set("phone")} className="field-input" /></div>
              <div><label className="field-label">{t.nationality}</label>
                <input value={form.nationality} onChange={set("nationality")} className="field-input" /></div>
              <div><label className="field-label">{t.dob}</label>
                <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} className="field-input" /></div>
              <div><label className="field-label">{t.id_type}</label>
                <select value={form.id_type} onChange={set("id_type")} className="field-input">
                  <option value="">—</option>
                  {idTypes.map((o: any) => (
                    <option key={o.value_en} value={o.value_en}>{lang === "fr" ? o.value_fr : o.value_en}</option>
                  ))}
                </select></div>
              <div><label className="field-label">{t.id_number}</label>
                <input value={form.id_number} onChange={set("id_number")} className="field-input" /></div>
              <div><label className="field-label">{t.expiry_date}</label>
                <input type="date" value={form.id_expiry_date} onChange={set("id_expiry_date")} className="field-input" /></div>
              <div className="col-span-2"><label className="field-label">{t.address}</label>
                <input value={form.address} onChange={set("address")} className="field-input" /></div>
              <div className="col-span-2"><label className="field-label">{t.notes}</label>
                <textarea value={form.notes} onChange={set("notes")} rows={2} className="field-input" /></div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                {saving ? t.loading : t.save}
              </button>
              <button onClick={() => { setEditing(false); setErr(""); }}
                className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
