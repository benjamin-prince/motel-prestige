"use client";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Modal, ConfirmDialog, StatCardGrid, SearchInput } from "@/components/ui";

type SalesAccount = {
  id: number;
  name: string;
  account_type: "corporate" | "travel_agent" | "ota";
  contact_name: string;
  phone: string;
  email: string;
  commission_pct: number;
  credit_limit: number;
  payment_terms_days: number;
  notes: string;
  is_active: boolean;
};

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const TYPE_META: Record<
  SalesAccount["account_type"],
  { bg: string; color: string; en: string; fr: string }
> = {
  corporate:    { bg: "#e3f2fd", color: "#1565c0", en: "Corporate",    fr: "Corporate" },
  travel_agent: { bg: "#ede9fe", color: "#7c3aed", en: "Travel Agent", fr: "Agence de Voyage" },
  ota:          { bg: "#ffedd5", color: "#d97706", en: "OTA",          fr: "OTA" },
};

const EMPTY = {
  name: "",
  account_type: "corporate" as SalesAccount["account_type"],
  contact_name: "",
  phone: "",
  email: "",
  commission_pct: "",
  credit_limit: "",
  payment_terms_days: "",
  notes: "",
  is_active: true,
};

export default function SalesAgentsPage() {
  const { lang } = useI18n();
  const { can } = usePermissions();
  const canManage = can("sales.agents.manage");
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);

  const [accounts, setAccounts] = useState<SalesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | SalesAccount["account_type"]>("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SalesAccount | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<SalesAccount | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getSalesAccounts();
      setAccounts(data as SalesAccount[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, account_type: typeFilter || "corporate" });
    setError("");
    setShowForm(true);
  };

  const openEdit = (a: SalesAccount) => {
    setEditing(a);
    setForm({
      name: a.name || "",
      account_type: a.account_type,
      contact_name: a.contact_name || "",
      phone: a.phone || "",
      email: a.email || "",
      commission_pct: a.commission_pct != null ? String(a.commission_pct) : "",
      credit_limit: a.credit_limit != null ? String(a.credit_limit) : "",
      payment_terms_days: a.payment_terms_days != null ? String(a.payment_terms_days) : "",
      notes: a.notes || "",
      is_active: a.is_active,
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(L("Name is required", "Le nom est requis"));
      return;
    }
    const commission = form.commission_pct === "" ? 0 : Number(form.commission_pct);
    if (Number.isNaN(commission) || commission < 0 || commission > 100) {
      setError(L("Commission must be between 0 and 100", "La commission doit être entre 0 et 100"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        account_type: form.account_type,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email,
        commission_pct: commission,
        credit_limit: form.credit_limit === "" ? 0 : Number(form.credit_limit),
        payment_terms_days: form.payment_terms_days === "" ? 0 : Number(form.payment_terms_days),
        notes: form.notes,
        is_active: form.is_active,
      };
      if (editing) await api.updateSalesAccount(editing.id, payload);
      else await api.createSalesAccount(payload);
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      setError(err.message || "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await api.deleteSalesAccount(confirmDelete.id);
    setConfirmDelete(null);
    load();
  };

  // Stats
  const activeCount = accounts.filter(a => a.is_active).length;
  const avgCommission = accounts.length
    ? accounts.reduce((s, a) => s + (Number(a.commission_pct) || 0), 0) / accounts.length
    : 0;

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter(a => {
      if (typeFilter && a.account_type !== typeFilter) return false;
      if (
        q &&
        !`${a.name} ${a.contact_name} ${a.email} ${a.phone}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [accounts, typeFilter, search]);

  const TABS: { value: "" | SalesAccount["account_type"]; label: string }[] = [
    { value: "", label: L("All", "Tout") },
    { value: "corporate", label: L("Corporate", "Corporate") },
    { value: "travel_agent", label: L("Travel Agent", "Agence de Voyage") },
    { value: "ota", label: L("OTA", "OTA") },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {L("Corporate & Travel Agents", "Comptes Corporate & Agences")}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Manage B2B accounts, commissions & credit terms", "Gérez les comptes B2B, commissions et conditions de crédit")}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}
          >
            + {L("New Account", "Nouveau Compte")}
          </button>
        )}
      </div>

      {/* Stats */}
      <StatCardGrid
        loading={loading}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5"
        stats={[
          { label: L("Total Accounts", "Total Comptes"), value: accounts.length, icon: "🏢", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)" },
          { label: L("Active", "Actifs"), value: activeCount, icon: "✅", gradient: "linear-gradient(135deg,#059669,#10b981)" },
          { label: L("Avg Commission", "Commission Moy."), value: `${avgCommission.toFixed(1)}%`, icon: "💸", gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)" },
        ]}
      />

      {/* Search + type tabs */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`${L("Search accounts", "Rechercher un compte")}…`}
          className="relative flex-1 min-w-48 max-w-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value || "all"}
              onClick={() => setTypeFilter(tab.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={
                typeFilter === tab.value
                  ? { background: "var(--blue)", color: "#fff", borderColor: "transparent" }
                  : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <Modal
          maxWidth="max-w-2xl"
          title={editing ? `${L("Edit", "Modifier")} — ${editing.name}` : L("New Account", "Nouveau Compte")}
          onClose={() => { setShowForm(false); setEditing(null); }}
        >
          <form onSubmit={handleSave} className="p-6">
            {error && (
              <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "#fce4ec", color: "#b71c1c" }}>
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="field-label">
                  {L("Account Name", "Nom du Compte")}<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="field-input"
                  required
                />
              </div>
              <div>
                <label className="field-label">{L("Type", "Type")}</label>
                <select
                  value={form.account_type}
                  onChange={e => setForm(p => ({ ...p, account_type: e.target.value as SalesAccount["account_type"] }))}
                  className="field-input"
                >
                  <option value="corporate">{L("Corporate", "Corporate")}</option>
                  <option value="travel_agent">{L("Travel Agent", "Agence de Voyage")}</option>
                  <option value="ota">{L("OTA", "OTA")}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{L("Contact Name", "Nom du Contact")}</label>
                <input
                  value={form.contact_name}
                  onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{L("Phone", "Téléphone")}</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{L("Email", "Courriel")}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{L("Commission %", "Commission %")}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={form.commission_pct}
                  onChange={e => setForm(p => ({ ...p, commission_pct: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{L("Credit Limit (FCFA)", "Limite de Crédit (FCFA)")}</label>
                <input
                  type="number"
                  min={0}
                  value={form.credit_limit}
                  onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">{L("Payment Terms (days)", "Conditions de Paiement (jours)")}</label>
                <input
                  type="number"
                  min={0}
                  value={form.payment_terms_days}
                  onChange={e => setForm(p => ({ ...p, payment_terms_days: e.target.value }))}
                  className="field-input"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="field-label">{L("Notes", "Notes")}</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="field-input"
              />
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              />
              <span className="text-sm" style={{ color: "var(--text)" }}>{L("Active account", "Compte actif")}</span>
            </label>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? L("Saving…", "Enregistrement…") : L("Save", "Enregistrer")}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
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

      {/* Table */}
      <div className="card overflow-x-auto" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[
                L("Name", "Nom"),
                L("Type", "Type"),
                L("Contact", "Contact"),
                L("Commission", "Commission"),
                L("Credit Limit", "Limite de Crédit"),
                L("Terms", "Conditions"),
                L("Status", "Statut"),
                L("Actions", "Actions"),
              ].map((h, i) => (
                <th
                  key={i}
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12" style={{ color: "var(--muted)" }}>
                  {L("Loading…", "Chargement…")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-14">
                  <div className="text-4xl mb-2">🏢</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {L("No accounts yet", "Aucun compte pour le moment")}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((a, i) => {
                const tm = TYPE_META[a.account_type] ?? TYPE_META.corporate;
                return (
                  <tr
                    key={a.id}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--card)" : "var(--input-bg)" }}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{a.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="pill" style={{ background: tm.bg, color: tm.color }}>
                        {lang === "fr" ? tm.fr : tm.en}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.contact_name && (
                        <p className="text-sm" style={{ color: "var(--text)" }}>{a.contact_name}</p>
                      )}
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {a.phone || a.email || "—"}
                      </p>
                      {a.phone && a.email && (
                        <p className="text-xs" style={{ color: "var(--muted)" }}>{a.email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--text)" }}>
                      {Number(a.commission_pct) || 0}%
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                      {fmt(Number(a.credit_limit) || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>
                      {a.payment_terms_days || 0} {L("days", "jours")}
                    </td>
                    <td className="px-4 py-3">
                      {a.is_active ? (
                        <span className="pill pill-good">{L("Active", "Actif")}</span>
                      ) : (
                        <span className="pill pill-slate">{L("Inactive", "Inactif")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <button
                            onClick={() => openEdit(a)}
                            className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-gray-50 transition-colors"
                            style={{ borderColor: "var(--border)", color: "#1565c0" }}
                          >
                            {L("Edit", "Modifier")}
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => setConfirmDelete(a)}
                            className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-red-50 transition-colors"
                            style={{ borderColor: "#fca5a5", color: "#dc2626" }}
                          >
                            {L("Delete", "Supprimer")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
