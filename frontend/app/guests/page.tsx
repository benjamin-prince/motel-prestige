"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Guest } from "@/lib/types";
import { Modal, ConfirmDialog, StatCardGrid, SearchInput, SegmentedControl } from "@/components/ui";
import { usePermissions } from "@/lib/permissions";

const EMPTY: any = {
  first_name: "", last_name: "", email: "", phone: "", id_type: "",
  id_number: "", id_expiry_date: "", nationality: "", country_of_residence: "",
  date_of_birth: "", address: "", referred_by: "", notes: "",
  vip: false, loyalty_tier: "standard", loyalty_points: "", tags: "",
  marketing_opt_in: false, preferred_room_type: "", bed_preference: "",
  smoking_preference: "", dietary: "", preferences: "",
};

// Loyalty tiers — restrained luxe tones (gold is the hero).
const TIERS: Record<string, { label: string; color: string; bg: string }> = {
  standard: { label: "Standard", color: "var(--muted)", bg: "var(--input-bg)" },
  silver:   { label: "Silver",   color: "#7d8794",     bg: "#eef1f4" },
  gold:     { label: "Gold",     color: "var(--gold)", bg: "var(--gold-soft)" },
  platinum: { label: "Platinum", color: "#4a6480",     bg: "#e9eef4" },
};
const tierMeta = (t?: string) => TIERS[t || "standard"] || TIERS.standard;

const money = (n: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US",
    { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

function initials(g: { first_name: string; last_name: string }) {
  return `${g.first_name?.[0] || ""}${g.last_name?.[0] || ""}`.toUpperCase();
}

function TierChip({ tier }: { tier?: string }) {
  const m = tierMeta(tier);
  if (!tier || tier === "standard") return null;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  );
}

// ── 360° guest profile ────────────────────────────────────────────────────────
function GuestProfileModal({ guestId, onClose, onEdit, lang, t }:
  { guestId: number; onClose: () => void; onEdit: (g: any) => void; lang: string; t: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getGuestProfile(guestId).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [guestId]);

  const g = data?.guest;
  const s = data?.stats;
  const m = tierMeta(g?.loyalty_tier);
  const prefs: [string, string][] = g ? ([
    [lang === "fr" ? "Type de chambre" : "Room type", g.preferred_room_type],
    [lang === "fr" ? "Lit" : "Bed", g.bed_preference],
    [lang === "fr" ? "Fumeur" : "Smoking", g.smoking_preference],
    [lang === "fr" ? "Régime" : "Dietary", g.dietary],
  ].filter(([, v]) => v) as [string, string][]) : [];
  const tags = (g?.tags || "").split(",").map((x: string) => x.trim()).filter(Boolean);

  return (
    <Modal maxWidth="max-w-3xl" title={lang === "fr" ? "Profil client" : "Guest profile"} onClose={onClose}>
      <div className="p-6">
        {loading || !g ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : (
          <>
            {/* Identity header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--gold), var(--blue))",
                  boxShadow: "0 6px 18px -6px rgba(120,90,30,0.5), inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                {initials(g)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "var(--text)" }}>
                    {g.first_name} {g.last_name}
                  </h3>
                  {g.vip && <span title="VIP" style={{ color: "var(--gold)", fontSize: 18 }}>★</span>}
                  <TierChip tier={g.loyalty_tier} />
                </div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {g.email || "—"}{g.phone ? ` · ${g.phone}` : ""}{g.nationality ? ` · ${g.nationality}` : ""}
                </p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {lang === "fr" ? "Points" : "Points"}: <span className="tabular font-bold" style={{ color: "var(--gold)" }}>{g.loyalty_points ?? 0}</span>
                  </span>
                  {s.suggested_tier !== (g.loyalty_tier || "standard") && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                      {lang === "fr" ? "Palier suggéré" : "Suggested"}: {tierMeta(s.suggested_tier).label}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { onEdit(g); }} className="btn-secondary shrink-0">{t.edit}</button>
            </div>

            {/* Lifetime stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: lang === "fr" ? "Séjours" : "Stays", val: s.total_stays },
                { label: lang === "fr" ? "Nuits" : "Nights", val: s.total_nights },
                { label: lang === "fr" ? "Valeur vie" : "Lifetime", val: money(s.total_spend, lang) },
                { label: lang === "fr" ? "Moy./séjour" : "Avg/stay", val: money(s.avg_spend, lang) },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                  <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k.label}</div>
                  <div className="font-display tabular" style={{ fontSize: 22, fontWeight: 600, color: "var(--text)" }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Preferences + tags */}
            {(prefs.length > 0 || tags.length > 0) && (
              <div className="mb-6">
                <div className="section-title">{lang === "fr" ? "Préférences" : "Preferences"}</div>
                <div className="flex flex-wrap gap-2">
                  {prefs.map(([k, v]) => (
                    <span key={k} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      <span style={{ color: "var(--muted)" }}>{k}:</span> {v}
                    </span>
                  ))}
                  {tags.map((tg: string) => (
                    <span key={tg} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>#{tg}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Stay history */}
            <div className="section-title">{lang === "fr" ? "Historique des séjours" : "Stay history"}</div>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-sm">
                  <thead style={{ background: "var(--input-bg)" }}>
                    <tr>{[t.res_number || "Réf", t.room_col || "Room", lang === "fr" ? "Arrivée" : "Check-in",
                      lang === "fr" ? "Départ" : "Check-out", t.nights, lang === "fr" ? "Statut" : "Status",
                      lang === "fr" ? "Montant" : "Amount"].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.history.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-sm" style={{ color: "var(--muted)" }}>{t.no_data}</td></tr>
                    ) : data.history.map((r: any) => (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2 font-mono text-xs" style={{ color: "var(--blue)" }}>{r.reservation_number}</td>
                        <td className="px-3 py-2 tabular font-semibold" style={{ color: "var(--text)" }}>{r.room}</td>
                        <td className="px-3 py-2 tabular text-xs" style={{ color: "var(--muted)" }}>{r.check_in_date}</td>
                        <td className="px-3 py-2 tabular text-xs" style={{ color: "var(--muted)" }}>{r.check_out_date}</td>
                        <td className="px-3 py-2 tabular text-center">{r.nights}</td>
                        <td className="px-3 py-2"><span className="text-[11px]" style={{ color: "var(--muted)" }}>{r.status}</span></td>
                        <td className="px-3 py-2 tabular font-semibold text-right" style={{ color: "var(--text)" }}>{money(r.amount, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function GuestsPage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [idTypes, setIdTypes] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Guest | null>(null);
  const [filterHasId, setFilterHasId] = useState<"" | "yes" | "no">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);

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
      new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime());
    return stays[0]?.check_in_date || null;
  };
  const isCurrentlyStaying = (guestId: number) =>
    reservations.some(r => r.guest_id === guestId && r.status === "checked_in");

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, id_type: idTypes[0]?.value_en || "" });
    setError(""); setShowForm(true);
  };

  const openEdit = (guest: any) => {
    setProfileId(null);
    setEditing(guest);
    setForm({
      first_name: guest.first_name, last_name: guest.last_name,
      email: guest.email || "", phone: guest.phone || "",
      id_type: guest.id_type || "", id_number: guest.id_number || "",
      id_expiry_date: guest.id_expiry_date || "", nationality: guest.nationality || "",
      country_of_residence: guest.country_of_residence || "",
      date_of_birth: guest.date_of_birth || "", address: guest.address || "",
      referred_by: guest.referred_by || "", notes: guest.notes || "",
      vip: !!guest.vip, loyalty_tier: guest.loyalty_tier || "standard",
      loyalty_points: guest.loyalty_points ?? "", tags: guest.tags || "",
      marketing_opt_in: !!guest.marketing_opt_in,
      preferred_room_type: guest.preferred_room_type || "", bed_preference: guest.bed_preference || "",
      smoking_preference: guest.smoking_preference || "", dietary: guest.dietary || "",
      preferences: guest.preferences || "",
    });
    setError(""); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload: any = {};
      for (const [k, v] of Object.entries(form)) {
        if (typeof v === "boolean") payload[k] = v;
        else if (v !== "") payload[k] = v;
      }
      payload.first_name = form.first_name;
      payload.last_name = form.last_name;
      payload.email = form.email;
      if (payload.loyalty_points !== undefined) payload.loyalty_points = Number(payload.loyalty_points) || 0;
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

  const f = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p: any) => ({ ...p, [key]: e.target.value }));

  // Stats
  const thisMonth = new Date(); thisMonth.setDate(1);
  const newThisMonth = guests.filter(g => g.created_at && new Date(g.created_at) >= thisMonth).length;
  const vipCount = guests.filter(g => (g as any).vip).length;

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
          <h1 className="page-title">{t.nav_guests}</h1>
          <p className="page-subtitle">{guests.length} {t.guests_total.toLowerCase()}</p>
        </div>
        {can("guests.create") && (
          <button onClick={openCreate} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            + {t.new_guest}
          </button>
        )}
      </div>

      {/* Stats row */}
      <StatCardGrid loading={loading} stats={[
        { label: t.guests_total,   value: guests.length, icon: "👥", gradient: "linear-gradient(135deg,#836428,#a97e46)" },
        { label: t.new_this_month, value: newThisMonth,  icon: "🆕", gradient: "linear-gradient(135deg,#4a7a4e,#6faf6f)" },
        { label: "VIP",            value: vipCount,      icon: "★",  gradient: "linear-gradient(135deg,#a17c3f,#d9b978)" },
        { label: lang === "fr" ? "En Séjour" : "In-House", value: reservations.filter(r => r.status === "checked_in").length, icon: "🏨", gradient: "linear-gradient(135deg,#4a6480,#7d95ac)" },
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
              <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{error}</div>
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
              ] as [string, string, string, boolean][]).map(([label, key, type, required]) => (
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
                    <option key={o.value_en} value={o.value_en}>{lang === "fr" ? o.value_fr : o.value_en}</option>
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

            {/* Loyalty & preferences */}
            <div className="section-title" style={{ marginTop: 4 }}>{lang === "fr" ? "Fidélité & préférences" : "Loyalty & preferences"}</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="field-label">{lang === "fr" ? "Palier de fidélité" : "Loyalty tier"}</label>
                <select value={form.loyalty_tier} onChange={f("loyalty_tier")} className="field-input">
                  {Object.entries(TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Points" : "Points"}</label>
                <input type="number" value={form.loyalty_points} onChange={f("loyalty_points")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Type de chambre préféré" : "Preferred room type"}</label>
                <input value={form.preferred_room_type} onChange={f("preferred_room_type")} className="field-input" placeholder="suite, deluxe…" />
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Lit" : "Bed preference"}</label>
                <input value={form.bed_preference} onChange={f("bed_preference")} className="field-input" placeholder="king, twin…" />
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Fumeur" : "Smoking"}</label>
                <select value={form.smoking_preference} onChange={f("smoking_preference")} className="field-input">
                  <option value="">—</option>
                  <option value="no">{lang === "fr" ? "Non-fumeur" : "Non-smoking"}</option>
                  <option value="yes">{lang === "fr" ? "Fumeur" : "Smoking"}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Régime alimentaire" : "Dietary"}</label>
                <input value={form.dietary} onChange={f("dietary")} className="field-input" placeholder="vegetarian, halal…" />
              </div>
              <div className="col-span-2">
                <label className="field-label">{lang === "fr" ? "Étiquettes (séparées par des virgules)" : "Tags (comma-separated)"}</label>
                <input value={form.tags} onChange={f("tags")} className="field-input" placeholder="corporate, repeat, honeymoon" />
              </div>
            </div>
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text)" }}>
                <input type="checkbox" checked={!!form.vip} onChange={e => setForm((p: any) => ({ ...p, vip: e.target.checked }))} />
                <span style={{ color: "var(--gold)" }}>★</span> VIP
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--text)" }}>
                <input type="checkbox" checked={!!form.marketing_opt_in} onChange={e => setForm((p: any) => ({ ...p, marketing_opt_in: e.target.checked }))} />
                {lang === "fr" ? "Accepte le marketing" : "Marketing opt-in"}
              </label>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t.loading : t.save}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1">{t.cancel}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Profile modal */}
      {profileId !== null && (
        <GuestProfileModal guestId={profileId} lang={lang} t={t}
          onClose={() => setProfileId(null)} onEdit={(g) => openEdit(g)} />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${t.delete} ${confirmDelete.first_name} ${confirmDelete.last_name}?`}
          message={t.confirm_delete} confirmLabel={t.delete} cancelLabel={t.cancel}
          onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.name, t.email, t.phone, t.nationality,
                  lang === "fr" ? "Séjours" : "Stays",
                  lang === "fr" ? "Dernier Séjour" : "Last Stay",
                  t.actions].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-14">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{t.no_data}</p>
                </td></tr>
              ) : filtered.map((g) => {
                const stays = guestStayCount(g.id);
                const lastStay = guestLastStay(g.id);
                const inHouse = isCurrentlyStaying(g.id);
                return (
                  <tr key={g.id} style={{ borderBottom: "1px solid var(--border)" }}
                    className="transition-colors hover:brightness-[0.985]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setProfileId(g.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--gold), var(--blue))" }}>
                          {initials(g)}
                        </button>
                        <div>
                          <button onClick={() => setProfileId(g.id)} className="flex items-center gap-1.5 text-left">
                            <span className="font-semibold text-sm hover:underline" style={{ color: "var(--text)" }}>
                              {g.first_name} {g.last_name}
                            </span>
                            {(g as any).vip && <span title="VIP" style={{ color: "var(--gold)" }}>★</span>}
                            <TierChip tier={(g as any).loyalty_tier} />
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {inHouse && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: "var(--good-bg)", color: "var(--good)" }}>
                                ● {lang === "fr" ? "Présent" : "In-House"}
                              </span>
                            )}
                            {(g as any).id_number && (
                              <span className="text-[10px]" style={{ color: "var(--muted)" }}>🪪 {(g as any).id_number}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.email || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{g.nationality || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {stays > 0 ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full tabular"
                          style={{ background: stays >= 3 ? "var(--gold-soft)" : "var(--input-bg)", color: stays >= 3 ? "var(--gold)" : "var(--muted)" }}>{stays}</span>
                      ) : <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs tabular" style={{ color: "var(--muted)" }}>{lastStay || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setProfileId(g.id)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--blue)" }}>
                          {lang === "fr" ? "Profil" : "Profile"}
                        </button>
                        {can("guests.edit") && (
                          <button onClick={() => openEdit(g)}
                            className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.edit}</button>
                        )}
                        {can("guests.delete") && (
                          <button onClick={() => setConfirmDelete(g)}
                            className="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                            style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>{t.delete}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
