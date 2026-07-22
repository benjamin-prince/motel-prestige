"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Guest } from "@/lib/types";
import { Modal, ConfirmDialog, StatCardGrid, SearchInput, SegmentedControl } from "@/components/ui";

const EMPTY = {
  first_name: "", last_name: "", email: "", phone: "", id_type: "",
  id_number: "", id_expiry_date: "", nationality: "", country_of_residence: "",
  date_of_birth: "", address: "", referred_by: "", notes: "",
};

const AVATAR_COLORS = [
  "#3b5bdb","#7c3aed","#059669","#d97706","#dc2626","#0891b2","#c2410c","#4f46e5",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function GuestsPage() {
  const { t, lang } = useI18n();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [idTypes, setIdTypes] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Guest | null>(null);
  const [filterHasId, setFilterHasId] = useState<"" | "yes" | "no">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [g, ids, res] = await Promise.all([
        api.getGuests(search || undefined),
        api.getLookup("id_type"),
        api.getReservations(""),
      ]);
      setGuests(g); setIdTypes(ids); setReservations(res);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const guestStayCount = (guestId: number) =>
    reservations.filter(r => r.guest_id === guestId).length;

  const guestLastStay = (guestId: number) => {
    const stays = reservations.filter(r => r.guest_id === guestId).sort((a, b) =>
      new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
    );
    return stays[0]?.check_in_date || null;
  };

  const isCurrentlyStaying = (guestId: number) =>
    reservations.some(r => r.guest_id === guestId && r.status === "checked_in");

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, id_type: idTypes[0]?.value_en || "" });
    setError("");
    setShowForm(true);
  };

  const openEdit = (guest: Guest) => {
    setEditing(guest);
    setForm({
      first_name: guest.first_name, last_name: guest.last_name,
      email: guest.email || "", phone: guest.phone || "",
      id_type: (guest as any).id_type || "", id_number: (guest as any).id_number || "",
      id_expiry_date: (guest as any).id_expiry_date || "",
      nationality: guest.nationality || "",
      country_of_residence: (guest as any).country_of_residence || "",
      date_of_birth: (guest as any).date_of_birth || "",
      address: (guest as any).address || "",
      referred_by: (guest as any).referred_by || "",
      notes: (guest as any).notes || "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      // Optional fields (dates, etc.) must be omitted when empty —
      // the API rejects "" for date/typed fields.
      const payload: any = {};
      for (const [k, v] of Object.entries(form)) {
        if (v !== "") payload[k] = v;
      }
      payload.first_name = form.first_name;
      payload.last_name = form.last_name;
      payload.email = form.email;
      if (editing) { await api.updateGuest(editing.id, payload); }
      else { await api.createGuest(payload); }
      setShowForm(false); setEditing(null); setForm(EMPTY); load();
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deleteGuest(confirmDelete.id);
    setConfirmDelete(null); load();
  };

  const f = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }));

  // Stats
  const thisMonth = new Date(); thisMonth.setDate(1);
  const newThisMonth = guests.filter(g => g.created_at && new Date(g.created_at) >= thisMonth).length;
  const withId = guests.filter(g => (g as any).id_number).length;

  // Filtered
  const filtered = guests.filter(g => {
    if (filterHasId === "yes" && !(g as any).id_number) return false;
    if (filterHasId === "no" && (g as any).id_number) return false;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.nav_guests}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {guests.length} {t.guests_total.toLowerCase()}
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
          + {t.new_guest}
        </button>
      </div>

      {/* Stats row */}
      <StatCardGrid loading={loading} stats={[
        { label: t.guests_total,   value: guests.length, icon: "👥", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)" },
        { label: t.new_this_month, value: newThisMonth,  icon: "🆕", gradient: "linear-gradient(135deg,#059669,#10b981)" },
        { label: t.id_verified,    value: withId,        icon: "🪪", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
        { label: lang === "fr" ? "En Séjour" : "In-House", value: reservations.filter(r => r.status === "checked_in").length, icon: "🏨", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
      ]} />

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t.search}…`}
          className="relative flex-1 min-w-48 max-w-sm" />
        <SegmentedControl value={filterHasId} onChange={v => setFilterHasId(v as any)}
          options={[
            { value: "", label: t.all_guests },
            { value: "yes", label: t.id_verified },
            { value: "no", label: t.no_id },
          ]} />
      </div>

      {/* Guest form modal */}
      {showForm && (
        <Modal maxWidth="max-w-2xl"
          title={editing ? `${t.edit} — ${editing.first_name} ${editing.last_name}` : t.guest_information}
          onClose={() => { setShowForm(false); setEditing(null); }}>
            <form onSubmit={handleSave} className="p-6">
              {error && (
                <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {([
                  [t.name + " (First)", "first_name", "text", true],
                  [t.name + " (Last)",  "last_name",  "text", true],
                  [t.email,             "email",      "email", false],
                  [t.phone,             "phone",      "text",  false],
                  [t.nationality,       "nationality","text",  false],
                  [t.country_of_residence, "country_of_residence", "text", false],
                  [t.dob,               "date_of_birth", "date", false],
                  [t.id_number,         "id_number",  "text",  false],
                  [t.expiry_date,       "id_expiry_date", "date", false],
                  [t.referred_by,       "referred_by","text",  false],
                ] as [string, keyof typeof form, string, boolean][]).map(([label, key, type, required]) => (
                  <div key={key}>
                    <label className="field-label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
                    <input type={type} required={required} value={form[key]} onChange={f(key)} className="field-input" />
                  </div>
                ))}
                <div>
                  <label className="field-label">{t.id_type}</label>
                  <select value={form.id_type} onChange={f("id_type")} className="field-input">
                    <option value="">—</option>
                    {idTypes.map(o => (
                      <option key={o.value_en} value={o.value_en}>
                        {lang === "fr" ? o.value_fr : o.value_en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">{t.notes}</label>
                  <input value={form.notes} onChange={f("notes")} className="field-input" />
                </div>
              </div>
              <div className="mb-4">
                <label className="field-label">{t.address}</label>
                <textarea value={form.address} onChange={f("address")} rows={2} className="field-input" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                  {saving ? t.loading : t.save}
                </button>
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
          title={`${t.delete} ${confirmDelete.first_name} ${confirmDelete.last_name}?`}
          message={t.confirm_delete}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.name, t.email, t.phone, t.nationality, t.id_type, t.id_number,
                lang === "fr" ? "Séjours" : "Stays",
                lang === "fr" ? "Dernier Séjour" : "Last Stay",
                t.actions].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-14">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{t.no_data}</p>
                </td>
              </tr>
            ) : filtered.map((g, i) => {
              const stays = guestStayCount(g.id);
              const lastStay = guestLastStay(g.id);
              const inHouse = isCurrentlyStaying(g.id);
              const color = avatarColor(`${g.first_name}${g.last_name}`);
              return (
                <tr key={g.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: color }}>
                        {g.first_name[0]}{g.last_name[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                          {g.first_name} {g.last_name}
                        </p>
                        {inHouse && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#dcfce7", color: "#059669" }}>
                            ● {lang === "fr" ? "Présent" : "In-House"}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.email || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.nationality || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{(g as any).id_type || "—"}</td>
                  <td className="px-4 py-3">
                    {(g as any).id_number ? (
                      <span className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "#059669" }}>
                        🪪 {(g as any).id_number}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {stays > 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: stays >= 3 ? "#e3f2fd" : "var(--input-bg)", color: stays >= 3 ? "#1565c0" : "var(--muted)" }}>
                        {stays}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {lastStay || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(g)}
                        className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-gray-50 transition-colors"
                        style={{ borderColor: "var(--border)", color: "#1565c0" }}>{t.edit}</button>
                      <button onClick={() => setConfirmDelete(g)}
                        className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-red-50 transition-colors"
                        style={{ borderColor: "#fca5a5", color: "#dc2626" }}>{t.delete}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
