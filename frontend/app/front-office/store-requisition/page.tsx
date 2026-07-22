"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePermissions } from "@/lib/permissions";
import { api } from "@/lib/api";

const STATUS_META: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fef3c7", color: "#d97706" },
  approved: { bg: "#dcfce7", color: "#059669" },
  rejected: { bg: "#fce4ec", color: "#dc2626" },
};

export default function StoreRequisitionPage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { setRequisitions(await api.getRequisitions()); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const statusLabel = (s: string) =>
    s === "pending" ? t.req_pending : s === "approved" ? t.req_approved : s === "rejected" ? t.req_rejected : s;
  const itemName = (line: any) => (lang === "fr" ? line.name_fr : line.name_en);

  const decide = async (id: number, action: "approve" | "reject") => {
    setActionErr(""); setBusyId(id);
    try {
      if (action === "approve") await api.approveRequisition(id);
      else await api.rejectRequisition(id);
      await load();
    } catch (e: any) { setActionErr(e.message || ""); }
    finally { setBusyId(null); }
  };

  const counts = {
    pending: requisitions.filter(r => r.status === "pending").length,
    approved: requisitions.filter(r => r.status === "approved").length,
    rejected: requisitions.filter(r => r.status === "rejected").length,
  };

  const kpis = [
    { label: t.req_pending,  value: counts.pending,  icon: "⏳", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
    { label: t.req_approved, value: counts.approved, icon: "✅", gradient: "linear-gradient(135deg,#059669,#10b981)" },
    { label: t.req_rejected, value: counts.rejected, icon: "❌", gradient: "linear-gradient(135deg,#dc2626,#ef4444)" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="page-title">{t.fo_store_req_title}</h2>
          <p className="page-subtitle">{t.req_subtitle}</p>
        </div>
        {can("fo.store_req") && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", boxShadow: "0 4px 14px rgba(59,91,219,0.25)" }}>
            + {t.req_new}
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden"
            style={{ background: k.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{k.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{k.label}</div>
            <div className="text-3xl font-black text-white">{loading ? "—" : k.value}</div>
          </div>
        ))}
      </div>

      {actionErr && (
        <div className="p-3 mb-4 rounded-xl text-sm font-semibold" style={{ background: "#fce4ec", color: "#dc2626" }}>
          ⚠️ {actionErr}
        </div>
      )}

      {/* Requisitions table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : requisitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--muted)" }}>
            <div className="text-5xl mb-3">📝</div>
            <p className="text-base font-semibold" style={{ color: "var(--text)" }}>{t.req_none}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.req_number, t.req_department, t.req_items_col, t.req_requested_by, t.req_date, t.status, t.actions].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r, i) => {
                const meta = STATUS_META[r.status] || STATUS_META.pending;
                return (
                  <tr key={r.id}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                    <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: "var(--blue)" }}>{r.req_number}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{r.department}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {r.items.map((line: any) => (
                          <p key={line.id} className="text-xs" style={{ color: "var(--text)" }}>
                            <span className="font-bold">{Number(line.quantity).toLocaleString("fr-FR")}{line.unit ? ` ${line.unit}` : ""}</span>
                            {" — "}{itemName(line)}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>{r.requested_by || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(r.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                        {statusLabel(r.status)}
                      </span>
                      {r.decided_by && (
                        <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>{t.req_decided_by}: {r.decided_by}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && can("fo.store_req.approve") && (
                        <div className="flex gap-1.5">
                          <button onClick={() => decide(r.id, "approve")} disabled={busyId === r.id}
                            className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold disabled:opacity-60"
                            style={{ background: "#059669" }}>
                            {t.req_approve}
                          </button>
                          <button onClick={() => decide(r.id, "reject")} disabled={busyId === r.id}
                            className="text-xs px-3 py-1.5 rounded-lg font-semibold border disabled:opacity-60"
                            style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                            {t.req_reject}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <RequisitionModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RequisitionModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [department, setDepartment] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<{ item_id: string; quantity: string }[]>([{ item_id: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.getStoreItems().then(setItems).catch(() => {});
    api.getLookup("department").then(setDepartments).catch(() => {});
  }, []);

  const itemName = (it: any) => (lang === "fr" ? it.name_fr : it.name_en);
  const setLine = (i: number, patch: Partial<{ item_id: string; quantity: string }>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const valid = department && lines.length > 0 &&
    lines.every(l => l.item_id && Number(l.quantity) > 0) &&
    new Set(lines.map(l => l.item_id)).size === lines.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setErr("");
    try {
      await api.createRequisition({
        department, note: note || undefined,
        items: lines.map(l => ({ item_id: Number(l.item_id), quantity: Number(l.quantity) })),
      });
      onDone();
    } catch (e: any) { setErr(e.message || ""); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold" style={{ color: "var(--text)" }}>📝 {t.req_new}</h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--muted)" }}>×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="field-label">{t.req_department} *</label>
            <select required value={department} onChange={e => setDepartment(e.target.value)} className="field-input">
              <option value="">—</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.value_en}>{lang === "fr" ? d.value_fr : d.value_en}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">{t.req_items_col} *</label>
            <div className="space-y-2">
              {lines.map((line, i) => {
                const selected = items.find(it => String(it.id) === line.item_id);
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select required value={line.item_id} onChange={e => setLine(i, { item_id: e.target.value })} className="field-input">
                        <option value="">— {t.req_item} —</option>
                        {items.map(it => (
                          <option key={it.id} value={it.id}>
                            {itemName(it)} ({Number(it.quantity).toLocaleString("fr-FR")} {it.unit} {t.req_in_stock_hint})
                          </option>
                        ))}
                      </select>
                    </div>
                    <input type="number" min="0.01" step="any" required placeholder={t.req_qty}
                      value={line.quantity} onChange={e => setLine(i, { quantity: e.target.value })}
                      className="field-input w-24" />
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                        className="px-2.5 py-2 rounded-lg border text-sm" style={{ borderColor: "#fca5a5", color: "#dc2626" }}>
                        ×
                      </button>
                    )}
                    {selected && Number(line.quantity) > Number(selected.quantity) && (
                      <span className="text-xs font-semibold mt-2.5" style={{ color: "#d97706" }}>⚠️</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setLines(ls => [...ls, { item_id: "", quantity: "" }])}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--blue)" }}>
              + {t.req_add_line}
            </button>
          </div>

          <div>
            <label className="field-label">{t.req_note}</label>
            <input value={note} onChange={e => setNote(e.target.value)} className="field-input" />
          </div>

          {err && <p className="text-sm font-medium" style={{ color: "#dc2626" }}>⚠️ {err}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium border hover:bg-gray-50"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
            <button type="submit" disabled={busy || !valid}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}>
              {busy ? t.loading : t.req_create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
