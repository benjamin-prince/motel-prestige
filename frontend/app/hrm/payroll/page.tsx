"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Modal } from "@/components/ui";

type Payslip = {
  id: number;
  user_id: number;
  staff_name: string;
  period: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_pay: number;
  status: "draft" | "approved" | "paid";
  notes?: string | null;
};

type StaffMember = { id: number; full_name: string; role: string };

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const STATUS_META: Record<string, { bg: string; color: string; en: string; fr: string }> = {
  draft:    { bg: "var(--input-bg)", color: "var(--muted)", en: "Draft",    fr: "Brouillon" },
  approved: { bg: "var(--info-bg)",  color: "var(--info)",  en: "Approved", fr: "Approuvée" },
  paid:     { bg: "var(--good-bg)",  color: "var(--good)",  en: "Paid",     fr: "Payée" },
};

const NEXT_STATUS: Record<string, "approved" | "paid" | null> = {
  draft: "approved",
  approved: "paid",
  paid: null,
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function PayrollPage() {
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const L = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const canManage = can("hrm.payroll");

  const [period, setPeriod] = useState<string>(currentMonth());
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = async (p: string) => {
    setLoading(true);
    try {
      const [rows, users] = await Promise.all([
        api.getPayroll(p),
        api.getUsersBasic().catch(() => []),
      ]);
      setPayslips(rows);
      setStaff(users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); }, [period]);

  const totalNet = payslips.reduce((s, p) => s + Number(p.net_pay), 0);
  const staffCount = payslips.length;
  const pending = payslips.filter(p => p.status !== "paid").length;

  const advance = async (p: Payslip) => {
    const next = NEXT_STATUS[p.status];
    if (!next) return;
    try {
      await api.updatePayroll(p.id, { status: next });
      await load(period);
    } catch {
      /* surfaced by table reload; keep UX simple */
    }
  };

  const remove = async (p: Payslip) => {
    if (!confirm(L("Delete this payslip?", "Supprimer cette fiche de paie ?"))) return;
    try {
      await api.deletePayroll(p.id);
      await load(period);
    } catch {
      /* ignore */
    }
  };

  const openAdd = () => { setEditing(null); setShowModal(true); };
  const openEdit = (p: Payslip) => { setEditing(p); setShowModal(true); };

  const kpis = [
    { label: L("Total Net Payroll", "Masse Salariale Nette"), value: fmt(totalNet), gradient: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", icon: "💰" },
    { label: L("Staff Count", "Nombre d'Employés"), value: String(staffCount), gradient: "linear-gradient(135deg,#059669,#10b981)", icon: "👥" },
    { label: L("Pending", "En Attente"), value: String(pending), gradient: "linear-gradient(135deg,#d97706,#f59e0b)", icon: "⏳" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{L("Payroll", "Paie")}</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            {L("Manage monthly payslips for your staff", "Gérez les fiches de paie mensuelles de votre personnel")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="field-input" style={{ marginTop: 0, width: "auto" }} />
          {canManage && (
            <button onClick={openAdd}
              className="py-2.5 px-4 rounded-xl text-sm font-bold text-white whitespace-nowrap"
              style={{ background: "var(--blue)" }}>
              + {L("Add Payslip", "Ajouter une Fiche")}
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {kpis.map(c => (
          <div key={c.label} className="card p-5 relative overflow-hidden"
            style={{ background: c.gradient, border: "none" }}>
            <div className="absolute -right-3 -bottom-3 text-5xl opacity-20">{c.icon}</div>
            <div className="text-white/70 text-xs font-semibold mb-1">{c.label}</div>
            <div className="text-2xl font-black text-white">{loading ? "—" : c.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[
                L("Staff", "Employé"),
                L("Base Salary", "Salaire de Base"),
                L("Allowances", "Primes"),
                L("Deductions", "Déductions"),
                L("Net Pay", "Net à Payer"),
                L("Status", "Statut"),
                L("Actions", "Actions"),
              ].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : payslips.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-14">
                  <div className="text-3xl mb-2">💸</div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {L("No payslips for this month", "Aucune fiche de paie pour ce mois")}
                  </p>
                </td>
              </tr>
            ) : payslips.map((p, i) => {
              const meta = STATUS_META[p.status] || STATUS_META.draft;
              const next = NEXT_STATUS[p.status];
              return (
                <tr key={p.id}
                  style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{p.staff_name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--text)" }}>{fmt(Number(p.base_salary))}</td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#059669" }}>
                    {Number(p.allowances) > 0 ? `+${fmt(Number(p.allowances))}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold" style={{ color: "#dc2626" }}>
                    {Number(p.deductions) > 0 ? `-${fmt(Number(p.deductions))}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-black" style={{ color: "var(--text)" }}>{fmt(Number(p.net_pay))}</td>
                  <td className="px-4 py-3">
                    <span className="badge font-semibold" style={{ background: meta.bg, color: meta.color }}>
                      {lang === "fr" ? meta.fr : meta.en}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold border"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                          {L("Edit", "Modifier")}
                        </button>
                        {next && (
                          <button onClick={() => advance(p)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-bold text-white"
                            style={{ background: next === "paid" ? "var(--good)" : "var(--info)" }}>
                            {next === "approved" ? L("Approve", "Approuver") : L("Mark Paid", "Marquer Payée")}
                          </button>
                        )}
                        <button onClick={() => remove(p)}
                          className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                          style={{ color: "var(--bad)" }}>
                          {L("Delete", "Supprimer")}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {payslips.length > 1 && (
            <tfoot>
              <tr style={{ background: "var(--input-bg)", borderTop: "2px solid var(--border)" }}>
                <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: "var(--muted)" }}>
                  {L("Totals", "Totaux")}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "var(--text)" }}>
                  {fmt(payslips.reduce((s, p) => s + Number(p.base_salary), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "#059669" }}>
                  {fmt(payslips.reduce((s, p) => s + Number(p.allowances), 0))}
                </td>
                <td className="px-4 py-3 font-bold text-sm" style={{ color: "#dc2626" }}>
                  {fmt(payslips.reduce((s, p) => s + Number(p.deductions), 0))}
                </td>
                <td className="px-4 py-3 font-black text-sm" style={{ color: "var(--text)" }}>
                  {fmt(totalNet)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && canManage && (
        <PayslipModal
          key={editing?.id ?? "new"}
          editing={editing}
          period={period}
          staff={staff}
          L={L}
          lang={lang}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); load(period); }}
        />
      )}
    </div>
  );
}

function PayslipModal({ editing, period, staff, L, lang, onClose, onDone }: {
  editing: Payslip | null;
  period: string;
  staff: StaffMember[];
  L: (en: string, fr: string) => string;
  lang: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [userId, setUserId] = useState<string>(editing ? String(editing.user_id) : "");
  const [baseSalary, setBaseSalary] = useState<string>(editing ? String(editing.base_salary) : "");
  const [allowances, setAllowances] = useState<string>(editing ? String(editing.allowances) : "0");
  const [deductions, setDeductions] = useState<string>(editing ? String(editing.deductions) : "0");
  const [status, setStatus] = useState<string>(editing ? editing.status : "draft");
  const [notes, setNotes] = useState<string>(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const base = Number(baseSalary) || 0;
  const allow = Number(allowances) || 0;
  const deduct = Number(deductions) || 0;
  const netPreview = base + allow - deduct;

  const save = async () => {
    setErr("");
    if (!editing && !userId) { setErr(L("Please choose a staff member", "Veuillez choisir un employé")); return; }
    if (base < 0 || allow < 0 || deduct < 0) {
      setErr(L("Amounts must be zero or positive", "Les montants doivent être positifs ou nuls"));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.updatePayroll(editing.id, {
          base_salary: base,
          allowances: allow,
          deductions: deduct,
          status,
          notes,
        });
      } else {
        await api.createPayroll({
          user_id: Number(userId),
          period,
          base_salary: base,
          allowances: allow,
          deductions: deduct,
          status,
          notes,
        });
      }
      onDone();
    } catch (e: any) {
      setErr(e?.message || L("Something went wrong", "Une erreur est survenue"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={editing ? L("Edit Payslip", "Modifier la Fiche de Paie") : L("New Payslip", "Nouvelle Fiche de Paie")}
      onClose={onClose}
    >
      <div className="px-6 py-5 space-y-4">
        {/* Staff */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {L("Staff", "Employé")}
          </label>
          {editing ? (
            <div className="field-input flex items-center" style={{ color: "var(--text)", background: "var(--input-bg)" }}>
              {editing.staff_name}
            </div>
          ) : (
            <select value={userId} onChange={e => setUserId(e.target.value)} className="field-input">
              <option value="">— {L("Select a staff member", "Choisir un employé")} —</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>{s.full_name} · {s.role}</option>
              ))}
            </select>
          )}
        </div>

        {/* Period (read-only) */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {L("Period", "Période")}
          </label>
          <div className="field-input flex items-center" style={{ color: "var(--text)", background: "var(--input-bg)" }}>
            {period}
          </div>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {L("Base Salary", "Salaire de Base")}
            </label>
            <input type="number" min={0} value={baseSalary} onChange={e => setBaseSalary(e.target.value)}
              className="field-input" placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {L("Allowances", "Primes")}
            </label>
            <input type="number" min={0} value={allowances} onChange={e => setAllowances(e.target.value)}
              className="field-input" placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              {L("Deductions", "Déductions")}
            </label>
            <input type="number" min={0} value={deductions} onChange={e => setDeductions(e.target.value)}
              className="field-input" placeholder="0" />
          </div>
        </div>

        {/* Net preview */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: "var(--info-bg)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--info)" }}>
            {L("Net Pay (preview)", "Net à Payer (aperçu)")}
          </span>
          <span className="text-lg font-black" style={{ color: "var(--info)" }}>{fmt(netPreview)}</span>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {L("Status", "Statut")}
          </label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="field-input">
            {Object.entries(STATUS_META).map(([val, m]) => (
              <option key={val} value={val}>{lang === "fr" ? m.fr : m.en}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {L("Notes", "Notes")}
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="field-input" placeholder={L("Optional", "Optionnel")} />
        </div>

        {err && (
          <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            {L("Cancel", "Annuler")}
          </button>
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "var(--blue)", opacity: busy ? 0.6 : 1 }}>
            {busy ? "…" : L("Save", "Enregistrer")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
