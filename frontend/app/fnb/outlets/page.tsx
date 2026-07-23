"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Modal, ConfirmDialog, EmptyState } from "@/components/ui";

type Outlet = {
  id: number;
  name: string;
  outlet_type: "restaurant" | "bar";
  location: string;
  is_active: boolean;
};

const EMPTY = { name: "", outlet_type: "restaurant" as "restaurant" | "bar", location: "", is_active: true };

export default function FnbOutletsPage() {
  const { lang } = useI18n();
  const { can } = usePermissions();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const canManage = can("fnb.outlets");

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Outlet | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<Outlet | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const o = await api.getFnbOutlets();
      setOutlets(o);
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

  const openEdit = (o: Outlet) => {
    setEditing(o);
    setForm({
      name: o.name || "",
      outlet_type: o.outlet_type === "bar" ? "bar" : "restaurant",
      location: o.location || "",
      is_active: !!o.is_active,
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        outlet_type: form.outlet_type,
        location: form.location,
        is_active: form.is_active,
      };
      if (editing) { await api.updateFnbOutlet(editing.id, payload); }
      else { await api.createFnbOutlet(payload); }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      setError(err.message || L("Request failed", "Échec de la requête"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deleteFnbOutlet(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  const typeLabel = (t: string) => (t === "bar" ? L("Bar", "Bar") : L("Restaurant", "Restaurant"));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {L("F&B Outlets", "Points de Vente F&B")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Manage your restaurant & bar points of sale", "Gérez vos points de vente restaurant & bar")}
          </p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "var(--blue)" }}>
            + {L("New Outlet", "Nouveau Point de Vente")}
          </button>
        )}
      </div>

      {/* Grid / states */}
      {loading ? (
        <div className="card text-center py-16 text-sm" style={{ color: "var(--muted)" }}>
          {L("Loading…", "Chargement…")}
        </div>
      ) : outlets.length === 0 ? (
        <EmptyState
          icon="🍽️"
          message={L("No outlets yet — create your first restaurant or bar.", "Aucun point de vente — créez votre premier restaurant ou bar.")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map(o => (
            <div key={o.id} className="card p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="text-4xl leading-none">{o.outlet_type === "bar" ? "🍹" : "🍽️"}</div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold truncate" style={{ color: "var(--text)" }}>{o.name}</h3>
                  {o.location && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--muted)" }}>
                      📍 <span className="truncate">{o.location}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="pill" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
                  {o.outlet_type === "bar" ? "🍹" : "🍽️"} {typeLabel(o.outlet_type)}
                </span>
                <span className={o.is_active ? "pill pill-good" : "pill pill-slate"}>
                  {o.is_active ? L("Active", "Actif") : L("Inactive", "Inactif")}
                </span>
              </div>

              {canManage && (
                <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => openEdit(o)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:opacity-80"
                    style={{ borderColor: "var(--border)", color: "var(--blue)" }}>
                    {L("Edit", "Modifier")}
                  </button>
                  <button onClick={() => setConfirmDelete(o)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:opacity-80"
                    style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
                    {L("Delete", "Supprimer")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <Modal
          title={editing ? `${L("Edit", "Modifier")} — ${editing.name}` : L("New Outlet", "Nouveau Point de Vente")}
          onClose={() => { setShowForm(false); setEditing(null); }}>
          <form onSubmit={handleSave} className="p-6">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>
                {error}
              </div>
            )}

            <div className="mb-3">
              <label className="field-label">
                {L("Name", "Nom")}<span style={{ color: "var(--warn)" }} className="ml-0.5">*</span>
              </label>
              <input type="text" required value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="field-input" />
            </div>

            <div className="mb-3">
              <label className="field-label">{L("Type", "Type")}</label>
              <select value={form.outlet_type}
                onChange={e => setForm(p => ({ ...p, outlet_type: e.target.value as "restaurant" | "bar" }))}
                className="field-input">
                <option value="restaurant">{L("Restaurant", "Restaurant")}</option>
                <option value="bar">{L("Bar", "Bar")}</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="field-label">{L("Location", "Emplacement")}</label>
              <input type="text" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="field-input" />
            </div>

            <button type="button"
              onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className="flex items-center justify-between w-full mb-4 py-2">
              <span className="field-label" style={{ marginBottom: 0 }}>{L("Active", "Actif")}</span>
              <span className="relative inline-flex items-center rounded-full transition-colors"
                style={{ width: 40, height: 22, background: form.is_active ? "var(--good)" : "var(--border)" }}>
                <span className="absolute rounded-full bg-white transition-all"
                  style={{ width: 16, height: 16, top: 3, left: form.is_active ? 21 : 3 }} />
              </span>
            </button>

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--blue)" }}>
                {saving ? L("Saving…", "Enregistrement…") : L("Save", "Enregistrer")}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                className="flex-1 py-2 rounded-lg text-sm border"
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
          title={`${L("Delete", "Supprimer")} ${confirmDelete.name}?`}
          message={L("This action cannot be undone.", "Cette action est irréversible.")}
          confirmLabel={L("Delete", "Supprimer")}
          cancelLabel={L("Cancel", "Annuler")}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
