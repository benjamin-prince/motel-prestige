"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Currency } from "@/lib/types";
import { formatAmount } from "@/lib/currency";
import { Modal, ConfirmDialog, useToast } from "@/components/ui";

const XAF_SAMPLE = 120000;

export default function CurrenciesPage() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({ code: "", name: "", symbol: "", xaf_rate: "" });
  const [saving, setSaving] = useState(false);
  const [previewCur, setPreviewCur] = useState<Currency | null>(null);
  const [previewXaf, setPreviewXaf] = useState("120000");
  const [confirmDelete, setConfirmDelete] = useState<Currency | null>(null);

  const load = async () => {
    setLoading(true);
    try { setCurrencies(await api.getCurrencies()); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleRateUpdate = async (code: string) => {
    setSaving(true);
    try {
      await api.updateCurrency(code, { xaf_rate: Number(editRate) });
      setEditCode(null);
      setEditRate("");
      load();
    } finally { setSaving(false); }
  };

  const handleToggle = async (code: string, active: boolean) => {
    await api.updateCurrency(code, { is_active: !active });
    load();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createCurrency({ ...newForm, xaf_rate: Number(newForm.xaf_rate) });
      setShowAdd(false);
      setNewForm({ code: "", name: "", symbol: "", xaf_rate: "" });
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteCurrency(confirmDelete.code);
      setConfirmDelete(null);
      load();
    } catch (err: any) {
      toast(err.message || t.cannot_delete_default, "error");
      setConfirmDelete(null);
    }
  };

  const xafCur: Currency = currencies.find(c => c.code === "XAF") || { id: 0, code: "XAF", name: "Franc CFA BEAC", symbol: "FCFA", xaf_rate: 1, is_default: true, is_active: true };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
            {t.currency_management}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
            {t.base_currency_note}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
          + {t.add_currency}
        </button>
      </div>

      {/* Converter widget */}
      <div className="card p-5 mb-6">
        <div className="text-sm font-bold mb-3" style={{ color: "var(--text)" }}>
          {t.currency_converter}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="field-label">{t.amount_xaf}</label>
            <input type="number" value={previewXaf} onChange={e => setPreviewXaf(e.target.value)}
              className="field-input" style={{ width: 160 }} />
          </div>
          <div>
            <label className="field-label">{t.display_in}</label>
            <select value={previewCur?.code || "XAF"}
              onChange={e => setPreviewCur(currencies.find(c => c.code === e.target.value) || null)}
              className="field-input" style={{ width: 140 }}>
              {currencies.filter(c => c.is_active).map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </div>
          <div className="p-3 rounded-xl" style={{ background: "var(--blue-light)", minWidth: 200 }}>
            <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>
              {t.result}
            </div>
            <div className="text-lg font-black" style={{ color: "var(--blue)" }}>
              {formatAmount(Number(previewXaf), xafCur)}
            </div>
            {previewCur && previewCur.code !== "XAF" && (
              <div className="text-sm font-semibold mt-1" style={{ color: "var(--text)" }}>
                = {formatAmount(Number(previewXaf) / Number(previewCur.xaf_rate), previewCur)}
              </div>
            )}
            {previewCur && previewCur.code !== "XAF" && (
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                1 {previewCur.code} = {Number(previewCur.xaf_rate).toLocaleString("fr-FR")} XAF
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add currency modal */}
      {showAdd && (
        <Modal title={t.add_currency} onClose={() => setShowAdd(false)}>
            <form onSubmit={handleAdd} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t.currency_code_label}</label>
                  <input required value={newForm.code} onChange={e => setNewForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="field-input" placeholder="GBP" maxLength={10} />
                </div>
                <div>
                  <label className="field-label">{t.currency_symbol_label}</label>
                  <input required value={newForm.symbol} onChange={e => setNewForm(f => ({ ...f, symbol: e.target.value }))}
                    className="field-input" placeholder="£" maxLength={10} />
                </div>
              </div>
              <div>
                <label className="field-label">{t.currency_name_label}</label>
                <input required value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className="field-input" placeholder={lang === "fr" ? "Livre Sterling" : "British Pound"} />
              </div>
              <div>
                <label className="field-label">1 {newForm.code || "???"} = ? XAF</label>
                <input type="number" required min="0.000001" step="0.000001" value={newForm.xaf_rate}
                  onChange={e => setNewForm(f => ({ ...f, xaf_rate: e.target.value }))}
                  className="field-input" placeholder="765" />
                {newForm.xaf_rate && (
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {XAF_SAMPLE.toLocaleString("fr-FR")} XAF = {(XAF_SAMPLE / Number(newForm.xaf_rate)).toFixed(2)} {newForm.code || "???"}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "…" : t.save}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              </div>
            </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${t.delete} ${confirmDelete.code}?`}
          message={t.confirm_delete}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Currency table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[
                t.currency_code_label,
                t.currency_name_label,
                t.currency_symbol_label,
                "1 devise = ? XAF",
                `120 000 XAF = ?`,
                t.updated,
                t.status,
                "",
              ].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : currencies.map((cur, i) => {
              const converted = cur.code === "XAF" ? XAF_SAMPLE : XAF_SAMPLE / Number(cur.xaf_rate);
              return (
                <tr key={cur.code} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)", opacity: cur.is_active ? 1 : 0.5 }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm" style={{ color: "var(--blue)" }}>{cur.code}</span>
                      {cur.is_default && (
                        <span className="badge text-xs" style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                          {t.default_label}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>{cur.name}</td>
                  <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--text)" }}>{cur.symbol}</td>
                  <td className="px-4 py-3">
                    {cur.is_default ? (
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>1 (base)</span>
                    ) : editCode === cur.code ? (
                      <div className="flex gap-2 items-center">
                        <input type="number" value={editRate} onChange={e => setEditRate(e.target.value)}
                          className="field-input" style={{ width: 100, fontSize: 12 }} />
                        <button onClick={() => handleRateUpdate(cur.code)} disabled={saving}
                          className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                          {saving ? "…" : "✓"}
                        </button>
                        <button onClick={() => { setEditCode(null); setEditRate(""); }}
                          className="text-xs px-2 py-1 rounded hover:bg-gray-100" style={{ color: "var(--muted)" }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditCode(cur.code); setEditRate(String(cur.xaf_rate)); }}
                        className="font-mono text-sm hover:underline" style={{ color: "var(--text)" }}>
                        {Number(cur.xaf_rate).toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                        <span className="ml-1 text-xs" style={{ color: "var(--blue)" }}>✎</span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--blue)" }}>
                    {formatAmount(converted, cur)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                    {cur.updated_at ? new Date(cur.updated_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={cur.is_active ? { background: "#e8f5e9", color: "#2e7d32" } : { background: "#f5f5f5", color: "#999" }}>
                      {cur.is_active ? t.active_status : t.inactive_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!cur.is_default && (
                        <button onClick={() => handleToggle(cur.code, cur.is_active)}
                          className="text-xs px-3 py-1 rounded-lg border font-medium hover:bg-gray-50"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          {cur.is_active ? t.disable : t.enable}
                        </button>
                      )}
                      {!cur.is_default && (
                        <button onClick={() => setConfirmDelete(cur)}
                          className="text-xs px-2.5 py-1 rounded-lg border font-medium hover:bg-red-50 transition-colors"
                          style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                          {t.delete}
                        </button>
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
  );
}
