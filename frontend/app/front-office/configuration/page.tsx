"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import Link from "next/link";
import { Modal, SkeletonCards } from "@/components/ui";

const ITEM_ICONS: Record<string, string> = {
  "room rent": "🛏️", "gym": "🏋️", "min bar": "🍸", "restaurant": "🍽️",
  "laundry": "👕", "spa": "💆", "parking": "🅿️", "phone": "📞",
  "extra bed": "🛌", "transfer": "🚌",
};
const icon = (name: string) => ITEM_ICONS[name.toLowerCase()] || "💰";

export default function ConfigurationPage() {
  const { t, lang } = useI18n();
  const [particulars, setParticulars] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name_en: "", name_fr: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, rt, r] = await Promise.all([
        api.getFolioParticulars(true),
        api.getRoomTypes(),
        api.getRooms(),
      ]);
      setParticulars(p); setRoomTypes(rt); setRooms(r);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const avgRate = (typeCode: string) => {
    const tr = rooms.filter(r => r.room_type === typeCode);
    if (!tr.length) return null;
    return Math.round(tr.reduce((s, r) => s + Number(r.price_per_night), 0) / tr.length);
  };

  const openCreate = () => { setEditing(null); setForm({ name_en: "", name_fr: "" }); setShowForm(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name_en: p.name_en, name_fr: p.name_fr }); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await api.updateFolioParticular(editing.id, form); }
      else { await api.createFolioParticular({ ...form, is_active: true }); }
      setShowForm(false); setEditing(null); load();
    } finally { setSaving(false); }
  };

  const toggleActive = async (p: any) => {
    await api.updateFolioParticular(p.id, { is_active: !p.is_active });
    load();
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="page-title">{t.fo_config_title}</h2>
          <p className="page-subtitle">
            {lang === "fr" ? "Gérez les postes de charge et les types de chambre" : "Manage charge items and room type reference"}
          </p>
        </div>
      </div>

      {/* Folio Particulars */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              {t.fo_folio_items}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.fo_folio_items_desc}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
            + {t.fo_add_item}
          </button>
        </div>

        {loading ? (
          <SkeletonCards count={8} height={100} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {particulars.map(p => (
              <div key={p.id} className="card p-4 flex flex-col gap-2"
                style={{ borderLeft: `3px solid ${p.is_active ? "#3b5bdb" : "#e5e7eb"}`, opacity: p.is_active ? 1 : 0.55 }}>
                <div className="flex items-start justify-between">
                  <span className="text-xl">{icon(p.name_en)}</span>
                  <button onClick={() => toggleActive(p)}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full transition-colors"
                    style={p.is_active
                      ? { background: "#dcfce7", color: "#059669" }
                      : { background: "#f3f4f6", color: "#9ca3af" }}>
                    {p.is_active ? t.fo_item_active : t.fo_item_inactive}
                  </button>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{p.name_en}</p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>{p.name_fr}</p>
                </div>
                <button onClick={() => openEdit(p)} className="text-xs font-semibold text-left"
                  style={{ color: "var(--blue)" }}>
                  {t.fo_edit_item} →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Room Rate Reference */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            {t.fo_rate_reference}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.fo_rate_reference_desc}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {roomTypes.map(rt => {
            const avg = avgRate(rt.type_code);
            const rtRooms = rooms.filter(r => r.room_type === rt.type_code);
            return (
              <div key={rt.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
                    {rt.type_code}
                  </span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {rtRooms.length} {lang === "fr" ? "ch." : "rms"}
                  </span>
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: "var(--text)" }}>
                  {lang === "fr" ? rt.name_fr : rt.name_en}
                </p>
                {avg !== null ? (
                  <p className="text-base font-black" style={{ color: "var(--blue)" }}>
                    {avg.toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>FCFA/nuit</span>
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: "var(--muted)" }}>—</p>
                )}
                {rtRooms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {rtRooms.slice(0, 6).map(r => (
                      <span key={r.id} className="text-xs px-1.5 py-0.5 rounded font-mono"
                        style={{ background: "var(--input-bg)", color: "var(--text)" }}>
                        {r.room_number}
                      </span>
                    ))}
                    {rtRooms.length > 6 && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: "var(--muted)" }}>
                        +{rtRooms.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <Link href="/rooms" className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
            {lang === "fr" ? "Gérer les chambres →" : "Manage Rooms →"}
          </Link>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <Modal title={editing ? `${t.fo_edit_item} — ${editing.name_en}` : t.fo_add_item}
          onClose={() => setShowForm(false)}>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="field-label">{t.value_en} *</label>
                <input required value={form.name_en}
                  onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))}
                  className="field-input" placeholder="Room Rent" />
              </div>
              <div>
                <label className="field-label">{t.value_fr} *</label>
                <input required value={form.name_fr}
                  onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))}
                  className="field-input" placeholder="Loyer Chambre" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                  {saving ? t.loading : t.save}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                  {t.cancel}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
