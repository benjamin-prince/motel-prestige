"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { api } from "@/lib/api";

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const CATEGORY_COLORS: Record<string, string> = {
  linen: "#7c3aed", toiletries: "#0891b2", minibar: "#d97706",
  cleaning: "#059669", office: "#3b5bdb", food: "#e11d48", general: "#6b7280",
};

export default function StockStatusPage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [movementsItem, setMovementsItem] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await api.getStoreItems()); }
    catch (e: any) { setError(e.message || ""); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const itemName = (it: any) => (lang === "fr" ? it.name_fr : it.name_en);
  const catLabel = (c: string) => (t as any)[`stock_cat_${c}`] || c;
  const qty = (it: any) => Number(it.quantity);
  const low = items.filter(it => qty(it) > 0 && qty(it) <= Number(it.reorder_level));
  const out = items.filter(it => qty(it) <= 0);
  const totalValue = items.reduce((s, it) => s + qty(it) * Number(it.unit_price), 0);

  const stockBadge = (it: any) => {
    if (qty(it) <= 0) return { label: t.stock_out_badge, bg: "#fce4ec", color: "#dc2626" };
    if (qty(it) <= Number(it.reorder_level)) return { label: t.stock_low_badge, bg: "#fef3c7", color: "#d97706" };
    return { label: t.stock_in_stock, bg: "#dcfce7", color: "#059669" };
  };

  const kpis = [
    { label: t.stock_total_items, value: String(items.length), icon: "📦", gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)" },
    { label: t.stock_value,       value: fmt(totalValue),      icon: "💰", gradient: "linear-gradient(135deg,#059669,#10b981)" },
    { label: t.stock_low,         value: String(low.length),   icon: "⚠️", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
    { label: t.stock_out,         value: String(out.length),   icon: "🚫", gradient: "linear-gradient(135deg,#dc2626,#ef4444)" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="page-title">{t.fo_stock_title}</h2>
          <p className="page-subtitle">{t.stock_subtitle}</p>
        </div>
        {can("fo.stock") && (
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
            + {t.stock_add_item}
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden"
            style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
            <div className="text-2xl font-black text-white">{loading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-xl text-sm font-semibold" style={{ background: "#fce4ec", color: "#dc2626" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Items table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--muted)" }}>
            <div className="text-5xl mb-3">📦</div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>{t.stock_no_items}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.stock_item_col, t.stock_category, t.stock_qty, t.stock_reorder, t.stock_unit_price, t.status, t.actions].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const badge = stockBadge(it);
                const catColor = CATEGORY_COLORS[it.category] || "#6b7280";
                return (
                  <tr key={it.id}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{itemName(it)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: `${catColor}18`, color: catColor }}>
                        {catLabel(it.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black" style={{ color: badge.color }}>
                      {Number(it.quantity).toLocaleString("fr-FR")} <span className="font-normal text-xs" style={{ color: "var(--muted)" }}>{it.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{Number(it.reorder_level).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3 text-xs font-semibold" style={{ color: "var(--text)" }}>{fmt(Number(it.unit_price))}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {can("fo.stock") && (
                          <button onClick={() => setAdjustItem(it)}
                            className="text-xs border px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                            style={{ borderColor: "var(--border)", color: "var(--blue)" }}>
                            {t.stock_adjust}
                          </button>
                        )}
                        <button onClick={() => setMovementsItem(it)}
                          className="text-xs border px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          {t.stock_movements}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {adjustItem && <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onDone={() => { setAdjustItem(null); load(); }} />}
      {movementsItem && <MovementsModal item={movementsItem} onClose={() => setMovementsItem(null)} />}
    </div>
  );
}

function AddItemModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name_en: "", name_fr: "", category: "general", unit: "pcs", quantity: "0", reorder_level: "0", unit_price: "0" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const categories = ["linen", "toiletries", "minibar", "cleaning", "office", "food", "general"];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api.createStoreItem({
        ...form,
        quantity: Number(form.quantity), reorder_level: Number(form.reorder_level), unit_price: Number(form.unit_price),
      });
      onDone();
    } catch (e: any) { setErr(e.message || ""); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>📦 {t.stock_add_item}</h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--muted)" }}>×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">{t.stock_name_en} *</label>
              <input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">{t.stock_name_fr} *</label>
              <input required value={form.name_fr} onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} className="field-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">{t.stock_category}</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="field-input">
                {categories.map(c => <option key={c} value={c}>{(t as any)[`stock_cat_${c}`] || c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t.stock_unit}</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="field-input" placeholder="pcs" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label">{t.stock_qty}</label>
              <input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">{t.stock_reorder}</label>
              <input type="number" min="0" value={form.reorder_level} onChange={e => setForm(f => ({ ...f, reorder_level: e.target.value }))} className="field-input" />
            </div>
            <div>
              <label className="field-label">{t.stock_unit_price}</label>
              <input type="number" min="0" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} className="field-input" />
            </div>
          </div>
          {err && <p className="text-sm font-medium" style={{ color: "#dc2626" }}>⚠️ {err}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
            <button type="submit" disabled={busy}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}>{busy ? t.loading : t.stock_save_item}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustModal({ item, onClose, onDone }: { item: any; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("purchase");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const reasons = direction === "in" ? ["purchase", "adjustment"] : ["adjustment", "damage"];
  useEffect(() => { setReason(direction === "in" ? "purchase" : "adjustment"); }, [direction]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number(amount)) return;
    setBusy(true); setErr("");
    try {
      await api.adjustStock(item.id, {
        change: direction === "in" ? Number(amount) : -Number(amount),
        reason, note: note || undefined,
      });
      onDone();
    } catch (e: any) { setErr(e.message || ""); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>
            ⚖️ {t.stock_adjust} — {lang === "fr" ? item.name_fr : item.name_en}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {Number(item.quantity).toLocaleString("fr-FR")} {item.unit} {t.req_in_stock_hint}
          </p>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["in", "out"] as const).map(d => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className="py-2.5 rounded-xl text-sm font-bold border transition-all"
                style={direction === d
                  ? { background: d === "in" ? "#dcfce7" : "#fce4ec", borderColor: d === "in" ? "#059669" : "#dc2626", color: d === "in" ? "#059669" : "#dc2626" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {d === "in" ? `↓ ${t.stock_direction_in}` : `↑ ${t.stock_direction_out}`}
              </button>
            ))}
          </div>
          <div>
            <label className="field-label">{t.stock_quantity_label} *</label>
            <input type="number" min="0.01" step="any" required value={amount}
              onChange={e => setAmount(e.target.value)} className="field-input" />
          </div>
          <div>
            <label className="field-label">{t.stock_reason}</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="field-input">
              {reasons.map(r => <option key={r} value={r}>{(t as any)[`stock_reason_${r}`] || r}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t.req_note}</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="field-input" />
          </div>
          {err && <p className="text-sm font-medium" style={{ color: "#dc2626" }}>⚠️ {err}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
            <button type="submit" disabled={busy || !Number(amount)}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: direction === "in" ? "#059669" : "#dc2626" }}>
              {busy ? t.loading : t.stock_adjust}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MovementsModal({ item, onClose }: { item: any; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStockMovements(item.id, 50).then(setMovements).catch(() => {}).finally(() => setLoading(false));
  }, [item.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>
            📋 {t.stock_movement_history} — {lang === "fr" ? item.name_fr : item.name_en}
          </h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--muted)" }}>×</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: "var(--muted)" }}>—</div>
          ) : movements.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 px-6 py-3"
              style={{ borderBottom: i < movements.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm"
                style={{ background: Number(m.change) >= 0 ? "#dcfce7" : "#fce4ec" }}>
                {Number(m.change) >= 0 ? "↓" : "↑"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {(t as any)[`stock_reason_${m.reason}`] || m.reason}{m.ref ? ` · ${m.ref}` : ""}
                </p>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(m.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}{m.posted_by ? ` · ${m.posted_by}` : ""}{m.note ? ` · ${m.note}` : ""}
                </p>
              </div>
              <p className="font-black text-sm" style={{ color: Number(m.change) >= 0 ? "#059669" : "#dc2626" }}>
                {Number(m.change) >= 0 ? "+" : ""}{Number(m.change).toLocaleString("fr-FR")} {item.unit}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
