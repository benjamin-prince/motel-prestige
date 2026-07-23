"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Modal, ConfirmDialog, StatCardGrid } from "@/components/ui";

type RatePackage = {
  id: number;
  code: string;
  name_en: string;
  name_fr: string;
  description: string;
  base_price: number;
  inclusions: string; // JSON-array-of-strings stored as a string
  min_nights: number;
  color: string;
  is_active: boolean;
};

const DEFAULT_COLOR = "#3b5bdb";

const EMPTY = {
  code: "",
  name_en: "",
  name_fr: "",
  description: "",
  base_price: "",
  min_nights: "1",
  color: DEFAULT_COLOR,
  inclusions: "", // one item per line in the textarea
  is_active: true,
};

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Parse the stored inclusions string (JSON array) into a string[] — tolerant of bad data. */
function parseInclusions(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string" && x.trim() !== "") : [];
  } catch {
    return [];
  }
}

export default function PackagesPage() {
  const { lang } = useI18n();
  const { can } = usePermissions();
  const canManage = can("sales.packages.manage");
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const [packages, setPackages] = useState<RatePackage[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RatePackage | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<RatePackage | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const p = await api.getPackages(false);
      setPackages(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setShowForm(true);
  };

  const openEdit = (p: RatePackage) => {
    setEditing(p);
    setForm({
      code: p.code || "",
      name_en: p.name_en || "",
      name_fr: p.name_fr || "",
      description: p.description || "",
      base_price: String(p.base_price ?? ""),
      min_nights: String(p.min_nights ?? 1),
      color: p.color || DEFAULT_COLOR,
      inclusions: parseInclusions(p.inclusions).join("\n"),
      is_active: !!p.is_active,
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const code = form.code.trim();
    if (!code) {
      setError(L("Code is required.", "Le code est obligatoire."));
      return;
    }
    const basePrice = Number(form.base_price);
    if (form.base_price === "" || Number.isNaN(basePrice) || basePrice < 0) {
      setError(L("Base price must be a positive number.", "Le tarif de base doit être un nombre positif."));
      return;
    }
    const minNights = Math.max(1, Math.floor(Number(form.min_nights) || 1));

    const inclusionLines = form.inclusions
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      code,
      name_en: form.name_en.trim(),
      name_fr: form.name_fr.trim(),
      description: form.description.trim(),
      base_price: basePrice,
      min_nights: minNights,
      color: form.color || DEFAULT_COLOR,
      inclusions: JSON.stringify(inclusionLines),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (editing) { await api.updatePackage(editing.id, payload); }
      else { await api.createPackage(payload); }
      closeForm();
      await load();
    } catch (err: any) {
      setError(err.message || L("Request failed", "Échec de la requête"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deletePackage(confirmDelete.id);
    setConfirmDelete(null);
    await load();
  };

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }));

  // Stats
  const activeCount = packages.filter(p => p.is_active).length;
  const avgPrice = useMemo(() => {
    if (!packages.length) return 0;
    return packages.reduce((s, p) => s + Number(p.base_price || 0), 0) / packages.length;
  }, [packages]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {L("Rate Packages", "Forfaits & Tarifs")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Manage sellable rate plans", "Gérez vos forfaits et plans tarifaires")}
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
            + {L("New Package", "Nouveau Forfait")}
          </button>
        )}
      </div>

      {/* Stats */}
      <StatCardGrid
        loading={loading}
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5"
        stats={[
          { label: L("Total Packages", "Total Forfaits"), value: packages.length, icon: "📦", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)" },
          { label: L("Active", "Actifs"), value: activeCount, icon: "✅", gradient: "linear-gradient(135deg,#059669,#10b981)" },
          { label: L("Avg. Base Price", "Tarif Moyen"), value: fmt(avgPrice), icon: "💰", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
        ]}
      />

      {/* Card grid */}
      {loading ? (
        <div className="card text-center py-12 text-sm" style={{ color: "var(--muted)" }}>
          {L("Loading…", "Chargement…")}
        </div>
      ) : packages.length === 0 ? (
        <div className="card text-center py-14">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            {L("No packages yet.", "Aucun forfait pour le moment.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(p => {
            const color = p.color || DEFAULT_COLOR;
            const inclusions = parseInclusions(p.inclusions);
            const name = (lang === "fr" ? p.name_fr : p.name_en) || p.name_en || p.name_fr || p.code;
            return (
              <div key={p.id} className="card overflow-hidden" style={{ padding: 0 }}>
                <div className="flex">
                  {/* Color accent bar */}
                  <div style={{ width: 6, background: color, flexShrink: 0 }} />
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{name}</h3>
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{p.code}</span>
                      </div>
                      <span className={`pill ${p.is_active ? "pill-good" : "pill-slate"}`}>
                        {p.is_active ? L("Active", "Actif") : L("Inactive", "Inactif")}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--muted)" }}>{p.description}</p>
                    )}

                    <div className="mt-3">
                      <span className="text-lg font-black" style={{ color: "var(--blue)" }}>{fmt(Number(p.base_price || 0))}</span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}> /{L("night", "nuit")}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                      {L("Min.", "Min.")} {p.min_nights} {p.min_nights > 1 ? L("nights", "nuits") : L("night", "nuit")}
                    </div>

                    {inclusions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {inclusions.map((inc, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "var(--input-bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                            {inc}
                          </span>
                        ))}
                      </div>
                    )}

                    {canManage && (
                      <div className="flex items-center gap-2 mt-4">
                        <button onClick={() => openEdit(p)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-gray-50 transition-colors"
                          style={{ borderColor: "var(--border)", color: "#1565c0" }}>
                          {L("Edit", "Modifier")}
                        </button>
                        <button onClick={() => setConfirmDelete(p)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-red-50 transition-colors"
                          style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                          {L("Delete", "Supprimer")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <Modal
          maxWidth="max-w-2xl"
          title={editing
            ? `${L("Edit", "Modifier")} — ${(lang === "fr" ? editing.name_fr : editing.name_en) || editing.code}`
            : L("New Package", "Nouveau Forfait")}
          onClose={closeForm}>
          <form onSubmit={handleSave} className="p-6">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="field-label">{L("Code", "Code")}<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" required value={form.code} onChange={set("code")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{L("Base Price (XAF)", "Tarif de Base (XAF)")}<span className="text-red-500 ml-0.5">*</span></label>
                <input type="number" min={0} step="any" required value={form.base_price} onChange={set("base_price")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{L("Name (English)", "Nom (Anglais)")}</label>
                <input type="text" value={form.name_en} onChange={set("name_en")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{L("Name (French)", "Nom (Français)")}</label>
                <input type="text" value={form.name_fr} onChange={set("name_fr")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{L("Min. Nights", "Nuits Min.")}</label>
                <input type="number" min={1} step={1} value={form.min_nights} onChange={set("min_nights")} className="field-input" />
              </div>
              <div>
                <label className="field-label">{L("Color", "Couleur")}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={set("color")}
                    style={{ width: 44, height: 38, padding: 2, borderRadius: 8, border: "1px solid var(--border)", background: "var(--input-bg)", cursor: "pointer" }} />
                  <input type="text" value={form.color} onChange={set("color")} className="field-input" style={{ marginTop: 0 }} />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="field-label">{L("Description", "Description")}</label>
              <textarea value={form.description} onChange={set("description")} rows={2} className="field-input" />
            </div>

            <div className="mb-3">
              <label className="field-label">{L("Inclusions (one per line)", "Inclusions (une par ligne)")}</label>
              <textarea value={form.inclusions} onChange={set("inclusions")} rows={4} className="field-input"
                placeholder={L("Breakfast\nAirport transfer\nLate checkout", "Petit-déjeuner\nNavette aéroport\nDépart tardif")} />
            </div>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <span className="text-sm" style={{ color: "var(--text)" }}>{L("Active", "Actif")}</span>
            </label>

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                {saving ? L("Saving…", "Enregistrement…") : L("Save", "Enregistrer")}
              </button>
              <button type="button" onClick={closeForm}
                className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {L("Cancel", "Annuler")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${L("Delete", "Supprimer")} ${(lang === "fr" ? confirmDelete.name_fr : confirmDelete.name_en) || confirmDelete.code}?`}
          message={L("This package will be permanently removed.", "Ce forfait sera définitivement supprimé.")}
          confirmLabel={L("Delete", "Supprimer")}
          cancelLabel={L("Cancel", "Annuler")}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
