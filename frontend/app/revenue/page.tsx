"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Modal, ConfirmDialog } from "@/components/ui";
import { usePermissions } from "@/lib/permissions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const RULE_EMPTY: any = {
  name: "", rule_type: "occupancy", room_type: "", adjust_type: "percent",
  adjust_value: "", occupancy_min: 80, date_from: "", date_to: "",
  weekdays: "", priority: 100, is_active: true,
};

const money = (n: number, lang: string) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US",
    { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function RevenuePage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const wd = lang === "fr" ? WEEKDAYS_FR : WEEKDAYS;

  const [cal, setCal] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [ov, setOv] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(RULE_EMPTY);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [c, r, o] = await Promise.all([
        api.getRateCalendar(14), api.getPricingRules(), api.getDashboardOverview(7),
      ]);
      setCal(c); setRules(r); setOv(o);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(RULE_EMPTY); setError(""); setShowForm(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      name: r.name, rule_type: r.rule_type, room_type: r.room_type || "",
      adjust_type: r.adjust_type, adjust_value: r.adjust_value ?? "",
      occupancy_min: r.occupancy_min ?? 80, date_from: r.date_from || "",
      date_to: r.date_to || "", weekdays: r.weekdays || "", priority: r.priority ?? 100,
      is_active: r.is_active,
    });
    setError(""); setShowForm(true);
  };

  const f = (k: string) => (e: any) => setForm((p: any) => ({ ...p, [k]: e.target.value }));
  const toggleWeekday = (i: number) => {
    const set = new Set((form.weekdays || "").split(",").filter(Boolean).map(Number));
    set.has(i) ? set.delete(i) : set.add(i);
    setForm((p: any) => ({ ...p, weekdays: [...set].sort().join(",") }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload: any = {
        name: form.name, rule_type: form.rule_type,
        room_type: form.room_type || null, adjust_type: form.adjust_type,
        adjust_value: Number(form.adjust_value) || 0,
        priority: Number(form.priority) || 100, is_active: !!form.is_active,
      };
      if (form.rule_type === "occupancy") payload.occupancy_min = Number(form.occupancy_min) || 0;
      if (form.rule_type === "season") { payload.date_from = form.date_from || null; payload.date_to = form.date_to || null; }
      if (form.rule_type === "weekday") payload.weekdays = form.weekdays || "";
      if (editing) await api.updatePricingRule(editing.id, payload);
      else await api.createPricingRule(payload);
      setShowForm(false); setEditing(null); load();
    } catch (err: any) { setError(err.message || "Request failed"); }
    finally { setSaving(false); }
  };

  const del = async () => { if (confirmDel) { await api.deletePricingRule(confirmDel.id); setConfirmDel(null); load(); } };

  const ruleCondition = (r: any) => {
    if (r.rule_type === "occupancy") return `${lang === "fr" ? "Occ. ≥" : "Occ ≥"} ${r.occupancy_min ?? 0}%`;
    if (r.rule_type === "season") return `${r.date_from || "…"} → ${r.date_to || "…"}`;
    if (r.rule_type === "weekday") return (r.weekdays || "").split(",").filter(Boolean).map((i: string) => wd[+i]).join(" ");
    return "—";
  };
  const adjLabel = (r: any) => r.adjust_type === "percent"
    ? `${Number(r.adjust_value) >= 0 ? "+" : ""}${Number(r.adjust_value)}%`
    : `${Number(r.adjust_value) >= 0 ? "+" : ""}${money(Number(r.adjust_value), lang)}`;

  const deltaColor = (d: number) => d > 0 ? "var(--gold)" : d < 0 ? "var(--good)" : "var(--muted)";

  const types: string[] = cal?.room_types || [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{t.nav_revenue}</h1>
          <p className="page-subtitle">{lang === "fr" ? "Tarification dynamique & rendement" : "Dynamic pricing & yield"}</p>
        </div>
        {can(["revenue.manage", "fo.configuration"]) && (
          <button onClick={openCreate} className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            + {lang === "fr" ? "Nouvelle règle" : "New rule"}
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: lang === "fr" ? "Occupation" : "Occupancy", val: ov ? `${ov.occupancy_pct}%` : "—", tone: "var(--blue)" },
          { label: "ADR", val: ov ? money(ov.adr, lang) : "—", tone: "var(--gold)" },
          { label: "RevPAR", val: ov ? money(ov.revpar, lang) : "—", tone: "var(--good)" },
        ].map(k => (
          <div key={k.label} className="card p-5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: k.tone }} />
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k.label}</div>
            <div className="font-display tabular mt-2" style={{ fontSize: 28, fontWeight: 600, color: "var(--text)" }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Rate calendar */}
      <div className="card overflow-hidden mb-5" style={{ padding: 0 }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="section-title" style={{ marginBottom: 2 }}>{lang === "fr" ? "Calendrier des tarifs" : "Rate calendar"}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {lang === "fr" ? "Tarif effectif par type de chambre après règles" : "Effective nightly rate per room type, after rules"}
            </div>
          </div>
          <span className="pill" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>14 {lang === "fr" ? "jours" : "days"}</span>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{lang === "fr" ? "Date" : "Date"}</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{lang === "fr" ? "Occ." : "Occ"}</th>
                  {types.map(ty => (
                    <th key={ty} className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wider capitalize" style={{ color: "var(--muted)" }}>
                      {ty}<div className="text-[10px] font-normal normal-case tabular" style={{ color: "var(--muted)" }}>{lang === "fr" ? "base" : "base"} {money(cal.base_by_type[ty], lang)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cal.days.map((d: any) => {
                  const dt = new Date(d.date + "T00:00");
                  const isWeekend = d.weekday >= 5;
                  return (
                    <tr key={d.date} style={{ borderBottom: "1px solid var(--border)", background: isWeekend ? "var(--gold-soft)" : "transparent" }}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>{wd[d.weekday]}</span>
                        <span className="text-xs tabular ml-1.5" style={{ color: "var(--muted)" }}>{dt.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { day: "2-digit", month: "short" })}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full" style={{ width: `${d.occupancy_pct}%`, background: d.occupancy_pct >= 80 ? "var(--gold)" : "var(--blue)" }} />
                          </div>
                          <span className="text-[11px] tabular" style={{ color: "var(--muted)" }}>{d.occupancy_pct}%</span>
                        </div>
                      </td>
                      {types.map(ty => {
                        const c = d.rates[ty];
                        return (
                          <td key={ty} className="px-3 py-2 text-right" title={c.applied.length ? c.applied.join(" · ") : ""}>
                            <span className="tabular font-semibold" style={{ color: "var(--text)" }}>{money(c.rate, lang)}</span>
                            {c.delta_pct !== 0 && (
                              <span className="text-[10px] tabular ml-1" style={{ color: deltaColor(c.delta_pct) }}>
                                {c.delta_pct > 0 ? "▲" : "▼"}{Math.abs(c.delta_pct)}%
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{lang === "fr" ? "Règles de tarification" : "Pricing rules"}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>{[lang === "fr" ? "Nom" : "Name", "Type", lang === "fr" ? "Portée" : "Scope",
                lang === "fr" ? "Condition" : "Condition", lang === "fr" ? "Ajust." : "Adjust", "Priorité", t.actions].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color: "var(--muted)" }}>
                  <div className="text-3xl mb-2">🏷️</div>{t.no_data}
                </td></tr>
              ) : rules.map(r => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", opacity: r.is_active ? 1 : 0.5 }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--text)" }}>
                    {r.name}
                    {!r.is_active && <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>{lang === "fr" ? "inactive" : "off"}</span>}
                  </td>
                  <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>{r.rule_type}</span></td>
                  <td className="px-4 py-2.5 text-xs capitalize" style={{ color: "var(--muted)" }}>{r.room_type || (lang === "fr" ? "Toutes" : "All")}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--text)" }}>{ruleCondition(r)}</td>
                  <td className="px-4 py-2.5 font-semibold tabular" style={{ color: Number(r.adjust_value) >= 0 ? "var(--gold)" : "var(--good)" }}>{adjLabel(r)}</td>
                  <td className="px-4 py-2.5 tabular text-xs" style={{ color: "var(--muted)" }}>{r.priority}</td>
                  <td className="px-4 py-2.5">
                    {can(["revenue.manage", "fo.configuration"]) && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(r)} className="text-xs px-2.5 py-1 rounded-lg border font-medium" style={{ borderColor: "var(--border)", color: "var(--blue)" }}>{t.edit}</button>
                        <button onClick={() => setConfirmDel(r)} className="text-xs px-2.5 py-1 rounded-lg border font-medium" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>{t.delete}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rule modal */}
      {showForm && (
        <Modal maxWidth="max-w-xl" title={editing ? (lang === "fr" ? "Modifier la règle" : "Edit rule") : (lang === "fr" ? "Nouvelle règle" : "New rule")}
          onClose={() => { setShowForm(false); setEditing(null); }}>
          <form onSubmit={save} className="p-6">
            {error && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{error}</div>}
            <div className="mb-3">
              <label className="field-label">{lang === "fr" ? "Nom de la règle" : "Rule name"}<span className="text-red-500">*</span></label>
              <input required value={form.name} onChange={f("name")} className="field-input" placeholder={lang === "fr" ? "Ex : Uplift week-end" : "e.g. Weekend uplift"} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="field-label">Type</label>
                <select value={form.rule_type} onChange={f("rule_type")} className="field-input">
                  <option value="occupancy">{lang === "fr" ? "Occupation (rendement)" : "Occupancy (yield)"}</option>
                  <option value="season">{lang === "fr" ? "Saison (dates)" : "Season (dates)"}</option>
                  <option value="weekday">{lang === "fr" ? "Jours de semaine" : "Weekday"}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Type de chambre" : "Room type"}</label>
                <select value={form.room_type} onChange={f("room_type")} className="field-input">
                  <option value="">{lang === "fr" ? "Toutes" : "All"}</option>
                  {types.map(ty => <option key={ty} value={ty} className="capitalize">{ty}</option>)}
                </select>
              </div>
            </div>

            {/* Condition by type */}
            {form.rule_type === "occupancy" && (
              <div className="mb-3">
                <label className="field-label">{lang === "fr" ? "Occupation minimale (%)" : "Minimum occupancy (%)"}</label>
                <input type="number" min={0} max={100} value={form.occupancy_min} onChange={f("occupancy_min")} className="field-input" />
              </div>
            )}
            {form.rule_type === "season" && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="field-label">{lang === "fr" ? "Du" : "From"}</label><input type="date" value={form.date_from} onChange={f("date_from")} className="field-input" /></div>
                <div><label className="field-label">{lang === "fr" ? "Au" : "To"}</label><input type="date" value={form.date_to} onChange={f("date_to")} className="field-input" /></div>
              </div>
            )}
            {form.rule_type === "weekday" && (
              <div className="mb-3">
                <label className="field-label">{lang === "fr" ? "Jours" : "Days"}</label>
                <div className="flex gap-1.5 flex-wrap">
                  {wd.map((d, i) => {
                    const on = (form.weekdays || "").split(",").filter(Boolean).map(Number).includes(i);
                    return (
                      <button type="button" key={i} onClick={() => toggleWeekday(i)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                        style={on ? { background: "var(--blue)", color: "#fff" } : { background: "var(--input-bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="field-label">{lang === "fr" ? "Ajustement" : "Adjust"}</label>
                <select value={form.adjust_type} onChange={f("adjust_type")} className="field-input">
                  <option value="percent">%</option>
                  <option value="fixed">$ {lang === "fr" ? "fixe" : "fixed"}</option>
                </select>
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Valeur" : "Value"}</label>
                <input type="number" step="any" value={form.adjust_value} onChange={f("adjust_value")} className="field-input" placeholder="+15" />
              </div>
              <div>
                <label className="field-label">{lang === "fr" ? "Priorité" : "Priority"}</label>
                <input type="number" value={form.priority} onChange={f("priority")} className="field-input" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer" style={{ color: "var(--text)" }}>
              <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((p: any) => ({ ...p, is_active: e.target.checked }))} />
              {lang === "fr" ? "Active" : "Active"}
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t.loading : t.save}</button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary flex-1">{t.cancel}</button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog title={`${t.delete} — ${confirmDel.name}?`} message={t.confirm_delete}
          confirmLabel={t.delete} cancelLabel={t.cancel} onConfirm={del} onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}
