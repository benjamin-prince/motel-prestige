"use client";
import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Modal, ConfirmDialog, useToast } from "@/components/ui";
import { parseFacilities, FacilityEntry, parseFloors, FloorEntry } from "@/lib/property-context";

// ── Types ──────────────────────────────────────────────────────────────────────

type S = Record<string, string>;
type Tab =
  | "hotel" | "policies" | "billing" | "housekeeping" | "maintenance"
  | "keycards" | "notifications" | "folio" | "dropdowns" | "roomtypes" | "sites"
  | "fnb" | "sales" | "hrm" | "reservations";

// ── Shared primitives ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>{title}</h4>
      <div className="card space-y-4" style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-3" style={{ gridTemplateColumns: "220px 1fr" }}>
      <div className="pt-2">
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} className="field-input" />
  );
}

function Toggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const on = value === "true";
  return (
    <button type="button" onClick={() => onChange(on ? "false" : "true")}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{ background: on ? "var(--blue)" : "var(--border)" }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }} />
    </button>
  );
}

function Stars({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(String(n))}
          style={{ fontSize: 22, color: n <= Number(value) ? "#f59e0b" : "var(--border)" }}>★</button>
      ))}
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, t }: {
  dirty: boolean; saving: boolean; onSave: () => void; t: any;
}) {
  return (
    <div className="flex items-center justify-between pt-2 mt-2 border-t" style={{ borderColor: "var(--border)" }}>
      <span className="text-xs" style={{ color: dirty ? "#d97706" : "var(--muted)" }}>
        {dirty ? `⚠ ${t.unsaved_changes}` : `✓ ${t.saved}`}
      </span>
      <button onClick={onSave} disabled={saving || !dirty}
        className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
        style={{ background: "var(--blue)" }}>
        {saving ? t.loading : t.save_changes}
      </button>
    </div>
  );
}

// ── useSettingsForm ─────────────────────────────────────────────────────────────

function useSettingsForm(allSettings: S, prefix: string) {
  const keys = Object.keys(allSettings).filter(k => k.startsWith(prefix + "."));
  const extract = useCallback((src: S) =>
    Object.fromEntries(keys.map(k => [k, src[k] ?? ""])), [JSON.stringify(keys)]);

  const [form, setForm] = useState<S>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Object.keys(allSettings).length) {
      setForm(extract(allSettings));
      setDirty(false);
    }
  }, [allSettings]);

  const set = (key: string, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setDirty(true);
  };

  const save = async (onSaved: (updated: S) => void) => {
    setSaving(true);
    try {
      const updated = await api.saveSettings(form);
      setDirty(false);
      onSaved(updated);
    } finally { setSaving(false); }
  };

  return { form, set, dirty, saving, save };
}

// ── Tab: Hotel Profile ─────────────────────────────────────────────────────────

const TIMEZONES = [
  "Africa/Abidjan","Africa/Accra","Africa/Addis_Ababa","Africa/Algiers","Africa/Douala",
  "Africa/Johannesburg","Africa/Kampala","Africa/Lagos","Africa/Nairobi","Africa/Tunis",
  "Europe/London","Europe/Paris","Europe/Berlin","America/New_York","America/Los_Angeles",
  "America/Sao_Paulo","Asia/Dubai","Asia/Singapore","Asia/Tokyo","Pacific/Auckland",
];

function HotelTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "hotel");
  const f = (k: string) => form[`hotel.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`hotel.${k}`, v);
  const [currencies, setCurrencies] = useState<any[]>([]);

  useEffect(() => {
    api.getCurrencies().then(setCurrencies);
  }, []);

  return (
    <div className="space-y-5">
      <Section title={t.hotel_identity}>
        <Row label={t.hotel_name_label}><Input value={f("name")} onChange={s("name")} /></Row>
        <Row label={t.hotel_legal_name}><Input value={f("legal_name")} onChange={s("legal_name")} /></Row>
        <Row label={t.hotel_star_rating}><Stars value={f("star_rating")} onChange={s("star_rating")} /></Row>
        <Row label={t.hotel_logo_url}><Input value={f("logo_url")} onChange={s("logo_url")} placeholder="https://…" /></Row>
        <Row label={t.hotel_vat_number}><Input value={f("vat_number")} onChange={s("vat_number")} /></Row>
        <Row label={t.hotel_registration_no}><Input value={f("registration_no")} onChange={s("registration_no")} /></Row>
      </Section>
      <Section title={t.hotel_location}>
        <Row label={t.address_line1}><Input value={f("address_line1")} onChange={s("address_line1")} /></Row>
        <Row label={t.address_line2}><Input value={f("address_line2")} onChange={s("address_line2")} /></Row>
        <div className="grid grid-cols-2 gap-4">
          <Row label={t.city}><Input value={f("city")} onChange={s("city")} /></Row>
          <Row label={t.state}><Input value={f("state")} onChange={s("state")} /></Row>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Row label={t.country}><Input value={f("country")} onChange={s("country")} /></Row>
          <Row label={t.zip}><Input value={f("zip")} onChange={s("zip")} /></Row>
        </div>
      </Section>
      <Section title={t.hotel_contact}>
        <Row label={t.phone}><Input value={f("phone")} onChange={s("phone")} type="tel" /></Row>
        <Row label={t.email}><Input value={f("email")} onChange={s("email")} type="email" /></Row>
        <Row label={t.website}><Input value={f("website")} onChange={s("website")} placeholder="https://…" /></Row>
      </Section>
      <Section title={t.hotel_system}>
        <Row label={t.timezone}>
          <select value={f("timezone")} onChange={e => s("timezone")(e.target.value)} className="field-input">
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Row>
        <Row label={t.default_currency}>
          <select value={f("currency")} onChange={e => s("currency")(e.target.value)} className="field-input">
            {currencies.filter(c => c.is_active).map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Policies ──────────────────────────────────────────────────────────────

function PoliciesTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "policy");
  const f = (k: string) => form[`policy.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`policy.${k}`, v);

  return (
    <div className="space-y-5">
      <Section title={t.check_in_checkout}>
        <Row label={t.policy_checkin_time}><Input value={f("check_in_time")} onChange={s("check_in_time")} type="time" /></Row>
        <Row label={t.policy_checkout_time}><Input value={f("check_out_time")} onChange={s("check_out_time")} type="time" /></Row>
      </Section>
      <Section title={t.fees_section}>
        <Row label={t.policy_late_checkout_fee}><Input value={f("late_checkout_fee")} onChange={s("late_checkout_fee")} type="number" /></Row>
        <Row label={t.policy_early_checkin_fee}><Input value={f("early_checkin_fee")} onChange={s("early_checkin_fee")} type="number" /></Row>
      </Section>
      <Section title={t.cancellation_section}>
        <Row label={t.policy_cancellation_hours}><Input value={f("cancellation_hours")} onChange={s("cancellation_hours")} type="number" /></Row>
        <Row label={t.policy_noshow_charge}><Input value={f("no_show_charge_pct")} onChange={s("no_show_charge_pct")} type="number" /></Row>
      </Section>
      <Section title={t.booking_rules}>
        <Row label={t.policy_max_stay}><Input value={f("max_stay_days")} onChange={s("max_stay_days")} type="number" /></Row>
        <Row label={t.policy_min_advance}><Input value={f("min_advance_booking")} onChange={s("min_advance_booking")} type="number" /></Row>
        <Row label={t.policy_allow_overbooking}><Toggle value={f("allow_overbooking")} onChange={s("allow_overbooking")} /></Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Billing ───────────────────────────────────────────────────────────────

function BillingTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "billing");
  const f = (k: string) => form[`billing.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`billing.${k}`, v);

  return (
    <div className="space-y-5">
      <Section title={t.billing_taxes}>
        <Row label={t.billing_tax_rate}><Input value={f("tax_rate")} onChange={s("tax_rate")} type="number" /></Row>
        <Row label={t.billing_service_charge}><Input value={f("service_charge")} onChange={s("service_charge")} type="number" /></Row>
        <Row label={t.billing_city_tax}><Input value={f("city_tax_per_person")} onChange={s("city_tax_per_person")} type="number" /></Row>
        <Row label={t.billing_show_tax}><Toggle value={f("show_tax_breakdown")} onChange={s("show_tax_breakdown")} /></Row>
      </Section>
      <Section title={t.billing_invoicing}>
        <Row label={t.billing_invoice_prefix}><Input value={f("invoice_prefix")} onChange={s("invoice_prefix")} placeholder="INV-" /></Row>
        <Row label={t.billing_invoice_start}><Input value={f("invoice_start_number")} onChange={s("invoice_start_number")} type="number" /></Row>
        <Row label={t.billing_receipt_header}>
          <textarea value={f("receipt_header")} onChange={e => s("receipt_header")(e.target.value)}
            rows={2} className="field-input resize-none" />
        </Row>
        <Row label={t.billing_invoice_footer}>
          <textarea value={f("invoice_footer")} onChange={e => s("invoice_footer")(e.target.value)}
            rows={3} className="field-input resize-none" />
        </Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Housekeeping ──────────────────────────────────────────────────────────

const HK_TASK_TYPES = ["cleaning", "turndown", "deep_clean", "inspection"];
const HK_PRIORITIES = ["normal", "priority", "urgent"];
const HK_STATUS_OPTIONS = [
  { key: "dirty",    label_en: "Dirty",         label_fr: "Sale",            color: "#ef4444" },
  { key: "cleaning", label_en: "In Cleaning",   label_fr: "En Nettoyage",    color: "#f59e0b" },
  { key: "inspected",label_en: "Inspected",     label_fr: "À Inspecter",     color: "#3b82f6" },
];

function HousekeepingTab({ allSettings, onSaved, t, lang }: { allSettings: S; onSaved: (s: S) => void; t: any; lang: string }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "housekeeping");
  const f = (k: string) => form[`housekeeping.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`housekeeping.${k}`, v);
  const l = (en: string, fr: string) => lang === "fr" ? fr : en;

  const TASK_TYPE_LABELS: Record<string, string> = {
    cleaning: l("Cleaning", "Nettoyage"),
    turndown: l("Turndown", "Couverture"),
    deep_clean: l("Deep Clean", "Nettoyage Profond"),
    inspection: l("Inspection", "Inspection"),
  };
  const PRIORITY_LABELS: Record<string, string> = {
    normal: l("Normal", "Normal"),
    priority: l("Priority", "Prioritaire"),
    urgent: l("Urgent", "Urgent"),
  };

  return (
    <div className="space-y-5">
      {/* Automation */}
      <Section title={t.hk_automation}>
        <Row label={t.hk_post_checkout_status}
          hint={l("Room HK status set immediately after guest checks out", "Statut HK attribué dès que le client part")}>
          <div className="flex gap-2">
            {HK_STATUS_OPTIONS.map(opt => (
              <button key={opt.key} type="button" onClick={() => s("post_checkout_status")(opt.key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={f("post_checkout_status") === opt.key
                  ? { borderColor: opt.color, background: opt.color + "15", color: opt.color }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: opt.color }} />
                  {lang === "fr" ? opt.label_fr : opt.label_en}
                </div>
              </button>
            ))}
          </div>
        </Row>
        <Row label={t.hk_grace_period}
          hint={l("Delay (in minutes) after check-out before room is flagged", "Délai en minutes avant signalement de la chambre")}>
          <div className="flex items-center gap-3">
            <Input value={f("checkout_grace_minutes")} onChange={s("checkout_grace_minutes")} type="number" />
            <span className="text-sm" style={{ color: "var(--muted)" }}>{l("minutes", "minutes")}</span>
          </div>
        </Row>
        <Row label={t.hk_auto_assign}
          hint={l("Automatically create a cleaning task when a room becomes dirty", "Créer automatiquement une tâche quand une chambre devient sale")}>
          <Toggle value={f("auto_assign_rooms")} onChange={s("auto_assign_rooms")} />
        </Row>
        <Row label={t.hk_inspection}
          hint={l("Room cannot be marked available until it has been inspected", "La chambre ne peut pas être disponible sans inspection")}>
          <Toggle value={f("inspection_required")} onChange={s("inspection_required")} />
        </Row>
        <Row label={t.hk_allow_skip_inspection}
          hint={l("Override: allow staff to mark clean without going through inspection", "Contournement : autoriser à marquer propre sans passer par l'inspection")}>
          <Toggle value={f("allow_skip_inspection")} onChange={s("allow_skip_inspection")} />
        </Row>
        <Row label={t.hk_notify_supervisor}>
          <Toggle value={f("notify_supervisor_on_complete")} onChange={s("notify_supervisor_on_complete")} />
        </Row>
      </Section>

      {/* Task Defaults */}
      <Section title={t.hk_task_defaults}>
        <Row label={t.hk_default_task_type}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {HK_TASK_TYPES.map(tt => (
              <button key={tt} type="button" onClick={() => s("default_task_type")(tt)}
                className="py-2 rounded-lg text-xs font-semibold border transition-colors"
                style={f("default_task_type") === tt
                  ? { borderColor: "var(--blue)", background: "#e3f2fd", color: "var(--blue)" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {TASK_TYPE_LABELS[tt]}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t.hk_default_priority}>
          <div className="flex gap-2">
            {HK_PRIORITIES.map(p => {
              const colors: Record<string, string> = { normal: "#6b7280", priority: "#f59e0b", urgent: "#ef4444" };
              const active = f("default_priority") === p;
              return (
                <button key={p} type="button" onClick={() => s("default_priority")(p)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors"
                  style={active
                    ? { borderColor: colors[p], background: colors[p] + "15", color: colors[p] }
                    : { borderColor: "var(--border)", color: "var(--muted)" }}>
                  {PRIORITY_LABELS[p]}
                </button>
              );
            })}
          </div>
        </Row>
        <Row label={t.hk_deep_clean_interval}
          hint={l("Number of days between mandatory deep cleans for each room", "Nombre de jours entre deux nettoyages en profondeur obligatoires")}>
          <div className="flex items-center gap-3">
            <Input value={f("deep_clean_interval_days")} onChange={s("deep_clean_interval_days")} type="number" />
            <span className="text-sm" style={{ color: "var(--muted)" }}>{l("days", "jours")}</span>
          </div>
        </Row>
      </Section>

      {/* Turndown Service */}
      <Section title={t.hk_turndown_section}>
        <Row label={t.hk_turndown_enabled}>
          <Toggle value={f("turndown_service_enabled")} onChange={s("turndown_service_enabled")} />
        </Row>
        {f("turndown_service_enabled") === "true" && (
          <div className="grid grid-cols-2 gap-4">
            <Row label={t.hk_turndown_start}>
              <Input value={f("turndown_start_time")} onChange={s("turndown_start_time")} type="time" />
            </Row>
            <Row label={t.hk_turndown_end}>
              <Input value={f("turndown_end_time")} onChange={s("turndown_end_time")} type="time" />
            </Row>
          </div>
        )}
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Maintenance ───────────────────────────────────────────────────────────

const MAINT_CATEGORIES = ["plumbing", "electrical", "hvac", "carpentry", "furniture", "general"];
const MAINT_PRIORITIES = [
  { key: "low",    color: "#22c55e" },
  { key: "medium", color: "#f59e0b" },
  { key: "high",   color: "#ef4444" },
  { key: "urgent", color: "#dc2626" },
];

function SlaBar({ hours }: { hours: string }) {
  const h = Number(hours) || 0;
  const pct = Math.min(100, Math.max(5, h <= 1 ? 8 : h <= 4 ? 20 : h <= 24 ? 50 : 100));
  const color = h <= 1 ? "#dc2626" : h <= 4 ? "#ef4444" : h <= 24 ? "#f59e0b" : "#22c55e";
  return (
    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function MaintenanceTab({ allSettings, onSaved, t, lang }: { allSettings: S; onSaved: (s: S) => void; t: any; lang: string }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "maintenance");
  const [users, setUsers] = useState<any[]>([]);
  const f = (k: string) => form[`maintenance.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`maintenance.${k}`, v);
  const l = (en: string, fr: string) => lang === "fr" ? fr : en;

  useEffect(() => {
    api.getUsersBasic().then(setUsers); // already filtered to active staff
  }, []);

  const CAT_LABELS: Record<string, string> = {
    plumbing: l("Plumbing", "Plomberie"),
    electrical: l("Electrical", "Électricité"),
    hvac: l("HVAC / A/C", "CVC / Clim"),
    carpentry: l("Carpentry", "Menuiserie"),
    furniture: l("Furniture", "Mobilier"),
    general: l("General", "Général"),
  };
  const CAT_ICONS: Record<string, string> = {
    plumbing: "🚿", electrical: "⚡", hvac: "❄️", carpentry: "🪚", furniture: "🪑", general: "🔧",
  };
  const PRI_LABELS: Record<string, string> = {
    low: l("Low", "Faible"), medium: l("Medium", "Moyen"), high: l("High", "Élevé"), urgent: l("Urgent", "Urgent"),
  };

  return (
    <div className="space-y-5">
      {/* SLA */}
      <Section title={t.maint_sla_section}>
        <div className="px-1 py-2 rounded-lg text-xs mb-2" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
          ℹ️ {t.maint_sla_hint}
        </div>
        {MAINT_PRIORITIES.map(p => (
          <Row key={p.key} label={t[`maint_sla_${p.key}`]}>
            <div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input value={f(`sla_${p.key}_hours`)} onChange={s(`sla_${p.key}_hours`)} type="number" />
                </div>
                <span className="text-sm shrink-0" style={{ color: "var(--muted)" }}>{l("hours", "heures")}</span>
                <span className="w-20 text-xs font-bold shrink-0 text-right" style={{ color: p.color }}>
                  {Number(f(`sla_${p.key}_hours`)) > 0
                    ? Number(f(`sla_${p.key}_hours`)) >= 24
                      ? `${Math.floor(Number(f(`sla_${p.key}_hours`)) / 24)}d`
                      : `${f(`sla_${p.key}_hours`)}h`
                    : "—"}
                </span>
              </div>
              <SlaBar hours={f(`sla_${p.key}_hours`)} />
            </div>
          </Row>
        ))}
      </Section>

      {/* Defaults */}
      <Section title={t.maint_defaults_section}>
        <Row label={t.maint_default_category}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {MAINT_CATEGORIES.map(c => (
              <button key={c} type="button" onClick={() => s("default_category")(c)}
                className="py-2 px-3 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5"
                style={f("default_category") === c
                  ? { borderColor: "var(--blue)", background: "#e3f2fd", color: "var(--blue)" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                <span>{CAT_ICONS[c]}</span>
                <span className="truncate">{CAT_LABELS[c]}</span>
              </button>
            ))}
          </div>
        </Row>
        <Row label={t.maint_default_priority}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MAINT_PRIORITIES.map(p => (
              <button key={p.key} type="button" onClick={() => s("default_priority")(p.key)}
                className="py-2 rounded-lg text-sm font-semibold border transition-colors"
                style={f("default_priority") === p.key
                  ? { borderColor: p.color, background: p.color + "15", color: p.color }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {PRI_LABELS[p.key]}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t.maint_default_assignee}
          hint={l("Pre-fill assignee when creating a new work order", "Pré-remplir le technicien à la création d'un ordre")}>
          <select value={f("default_assignee")} onChange={e => s("default_assignee")(e.target.value)} className="field-input">
            <option value="">— {l("None", "Aucun")} —</option>
            {users.map(u => <option key={u.id} value={String(u.id)}>{u.full_name} · {u.role}</option>)}
          </select>
        </Row>
      </Section>

      {/* Workflow */}
      <Section title={t.maint_workflow_section}>
        <Row label={t.maint_require_resolution}
          hint={l("Technician must enter resolution notes before closing a work order", "Le technicien doit saisir des notes avant de clôturer")}>
          <Toggle value={f("require_resolution_notes")} onChange={s("require_resolution_notes")} />
        </Row>
        <Row label={t.maint_allow_self_assign}
          hint={l("Technicians can assign work orders to themselves", "Les techniciens peuvent s'attribuer des ordres")}>
          <Toggle value={f("allow_self_assign")} onChange={s("allow_self_assign")} />
        </Row>
        <Row label={t.maint_escalation}
          hint={l("Automatically raise priority to High when SLA deadline is passed", "Passer automatiquement en priorité Élevée si le SLA est dépassé")}>
          <Toggle value={f("escalation_enabled")} onChange={s("escalation_enabled")} />
        </Row>
      </Section>

      {/* Notifications */}
      <Section title={t.maint_notif_section}>
        <Row label={t.maint_notify_on_open}>
          <Toggle value={f("notify_on_open")} onChange={s("notify_on_open")} />
        </Row>
        <Row label={t.maint_notify_on_assign}>
          <Toggle value={f("notify_assignee_on_assign")} onChange={s("notify_assignee_on_assign")} />
        </Row>
        <Row label={t.maint_notify_on_overdue}>
          <Toggle value={f("notify_on_overdue")} onChange={s("notify_on_overdue")} />
        </Row>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Key Cards ─────────────────────────────────────────────────────────────

function KeyCardsTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "keycards");
  const f = (k: string) => form[`keycards.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`keycards.${k}`, v);
  const isOrbita = f("provider") === "orbita";

  return (
    <div className="space-y-5">
      <Section title={t.kc_provider_section}>
        <Row label={t.kc_provider_label}>
          <div className="flex gap-3">
            {["simulated", "orbita"].map(opt => (
              <button key={opt} type="button" onClick={() => s("provider")(opt)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-colors"
                style={f("provider") === opt
                  ? { borderColor: "var(--blue)", background: "#e3f2fd", color: "var(--blue)" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {opt === "simulated" ? t.kc_simulated : t.kc_orbita}
              </button>
            ))}
          </div>
        </Row>
      </Section>
      {isOrbita && (
        <Section title={t.kc_connection}>
          <Row label={t.kc_bridge_url}><Input value={f("bridge_url")} onChange={s("bridge_url")} placeholder="http://…" /></Row>
          <Row label={t.kc_api_key}><Input value={f("api_key")} onChange={s("api_key")} type="password" /></Row>
          <Row label={t.kc_building}><Input value={f("building")} onChange={s("building")} /></Row>
        </Section>
      )}
      <Section title={t.kc_behavior}>
        <Row label={t.kc_door_prefix}><Input value={f("door_prefix")} onChange={s("door_prefix")} placeholder="ROOM-" /></Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Notifications ─────────────────────────────────────────────────────────

function NotificationsTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "notifications");
  const f = (k: string) => form[`notifications.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`notifications.${k}`, v);

  return (
    <div className="space-y-5">
      <Section title={t.notif_email}>
        <Row label={t.notif_from_name}><Input value={f("email_from_name")} onChange={s("email_from_name")} /></Row>
        <Row label={t.notif_from_address}><Input value={f("email_from_address")} onChange={s("email_from_address")} type="email" /></Row>
        <Row label={t.notif_smtp_host}><Input value={f("smtp_host")} onChange={s("smtp_host")} placeholder="smtp.example.com" /></Row>
        <div className="grid grid-cols-2 gap-4">
          <Row label={t.notif_smtp_port}><Input value={f("smtp_port")} onChange={s("smtp_port")} type="number" /></Row>
          <Row label={t.notif_smtp_tls}><Toggle value={f("smtp_tls")} onChange={s("smtp_tls")} /></Row>
        </div>
        <Row label={t.notif_smtp_user}><Input value={f("smtp_user")} onChange={s("smtp_user")} /></Row>
        <Row label={t.notif_smtp_pass}><Input value={f("smtp_pass")} onChange={s("smtp_pass")} type="password" /></Row>
      </Section>
      <Section title={t.notif_triggers}>
        <Row label={t.notif_checkin}><Toggle value={f("checkin_email")} onChange={s("checkin_email")} /></Row>
        <Row label={t.notif_checkout}><Toggle value={f("checkout_email")} onChange={s("checkout_email")} /></Row>
        <Row label={t.notif_reservation}><Toggle value={f("reservation_email")} onChange={s("reservation_email")} /></Row>
      </Section>
      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Folio Charges (from previous settings) ────────────────────────────────

function FolioTab({ t }: { t: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name_en: "", name_fr: "" });
  const [saving, setSaving] = useState(false);
  const load = async () => setItems(await api.getFolioParticulars(true));
  useEffect(() => { load(); }, []);
  const toggle = async (item: any) => { await api.updateFolioParticular(item.id, { is_active: !item.is_active }); load(); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await api.createFolioParticular(form); setForm({ name_en: "", name_fr: "" }); setShowAdd(false); load(); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t.folio_charges_desc}</p>
        <button onClick={() => setShowAdd(v => !v)}
          className="ml-4 shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          + {t.add_charge}
        </button>
      </div>
      {showAdd && (
        <form onSubmit={save} className="card flex items-end gap-3 flex-wrap" style={{ padding: "12px 16px", background: "var(--input-bg)" }}>
          <div className="flex-1 min-w-32"><label className="field-label">{t.value_en}</label><input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} className="field-input" autoFocus /></div>
          <div className="flex-1 min-w-32"><label className="field-label">{t.value_fr}</label><input required value={form.name_fr} onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} className="field-input" /></div>
          <div className="flex gap-2 pb-0.5">
            <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 disabled:opacity-60">{saving ? t.loading : t.save}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
          </div>
        </form>
      )}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.value_en, t.value_fr, t.status].map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "var(--text)" }}>{item.name_en}</td>
                <td className="px-5 py-3" style={{ color: "var(--muted)" }}>{item.name_fr}</td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(item)} className="text-xs border px-2.5 py-1 rounded-lg transition-colors"
                    style={item.is_active ? { borderColor: "#fca5a5", color: "#dc2626" } : { borderColor: "#a7f3d0", color: "#059669" }}>
                    {item.is_active ? t.deactivate : t.activate}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Dropdown Options ──────────────────────────────────────────────────────

const LOOKUP_GROUPS = [
  "arrival_mode", "payment_method", "id_type", "title",
  "gender", "guest_type", "guest_category", "resev_type", "bill_to", "property_type", "facility",
] as const;

function LookupGroup({ group, t }: { group: string; t: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ value_en: "", value_fr: "" });
  const [saving, setSaving] = useState(false);
  const labelKey = `group_${group}` as keyof typeof t;
  const load = async () => setItems(await api.getLookup(group, true));
  useEffect(() => { if (open) load(); }, [open]);
  const toggle = async (item: any) => { await api.updateLookup(item.id, { is_active: !item.is_active }); load(); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try { await api.createLookup({ group, ...form, sort_order: items.length }); setForm({ value_en: "", value_fr: "" }); setShowAdd(false); load(); }
    finally { setSaving(false); }
  };
  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <button className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors" onClick={() => setOpen(v => !v)}>
        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{(t[labelKey] as string) || group}</span>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {items.map((item, i) => (
            <div key={item.id} className="flex items-center gap-4 px-5 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
              <span className="flex-1 text-sm font-medium" style={{ color: "var(--text)" }}>{item.value_en}</span>
              <span className="flex-1 text-sm" style={{ color: "var(--muted)" }}>{item.value_fr}</span>
              <button onClick={() => toggle(item)} className="text-xs border px-2 py-0.5 rounded-lg transition-colors shrink-0"
                style={item.is_active ? { borderColor: "#fca5a5", color: "#dc2626" } : { borderColor: "#a7f3d0", color: "#059669" }}>
                {item.is_active ? t.deactivate : t.activate}
              </button>
            </div>
          ))}
          {showAdd ? (
            <form onSubmit={save} className="flex items-end gap-3 px-5 py-3 flex-wrap" style={{ background: "var(--input-bg)", borderTop: "1px solid var(--border)" }}>
              <div className="flex-1 min-w-28"><label className="field-label">{t.value_en}</label><input required value={form.value_en} onChange={e => setForm(f => ({ ...f, value_en: e.target.value }))} className="field-input" autoFocus /></div>
              <div className="flex-1 min-w-28"><label className="field-label">{t.value_fr}</label><input required value={form.value_fr} onChange={e => setForm(f => ({ ...f, value_fr: e.target.value }))} className="field-input" /></div>
              <div className="flex gap-2 pb-0.5">
                <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 disabled:opacity-60">{saving ? "…" : t.save}</button>
                <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              </div>
            </form>
          ) : (
            <div className="px-5 py-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setShowAdd(true)} className="text-xs font-semibold hover:underline" style={{ color: "#1565c0" }}>+ {t.add_option}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropdownsTab({ t }: { t: any }) {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "var(--muted)" }}>{t.dropdown_desc}</p>
      <div className="space-y-2">{LOOKUP_GROUPS.map(g => <LookupGroup key={g} group={g} t={t} />)}</div>
    </div>
  );
}

// ── Tab: Room Types ────────────────────────────────────────────────────────────

function RoomTypesTab({ t }: { t: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name_en: "", name_fr: "", default_image_url: "" });
  const [saving, setSaving] = useState(false);
  const load = async () => setItems(await api.getRoomTypes());
  useEffect(() => { load(); }, []);
  const openEdit = (item: any) => { setEditing(item); setForm({ name_en: item.name_en, name_fr: item.name_fr, default_image_url: item.default_image_url || "" }); };
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editing) return; setSaving(true);
    try { await api.updateRoomType(editing.id, form); setEditing(null); load(); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>{t.room_types_desc}</p>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <div key={item.id} className="card overflow-hidden" style={{ padding: 0 }}>
            {item.default_image_url && <img src={item.default_image_url} alt={item.name_en} className="w-full object-cover" style={{ height: 100 }} />}
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "var(--input-bg)", color: "var(--muted)" }}>{item.type_code}</span>
                <button onClick={() => openEdit(item)} className="text-xs border px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors" style={{ borderColor: "var(--border)", color: "#1565c0" }}>{t.edit}</button>
              </div>
              <p className="font-semibold text-sm mt-2" style={{ color: "var(--text)" }}>{item.name_en}</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>{item.name_fr}</p>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)}
          title={<>{t.room_types} — <span className="uppercase text-sm">{editing.type_code}</span></>}>
            <form onSubmit={save} className="p-6 space-y-4">
              <div><label className="field-label">{t.name_en}</label><input required value={form.name_en} onChange={e => setForm(f => ({ ...f, name_en: e.target.value }))} className="field-input" /></div>
              <div><label className="field-label">{t.name_fr}</label><input required value={form.name_fr} onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} className="field-input" /></div>
              <div>
                <label className="field-label">{t.image_url}</label>
                <input value={form.default_image_url} onChange={e => setForm(f => ({ ...f, default_image_url: e.target.value }))} className="field-input" placeholder="https://…" />
                {form.default_image_url && <img src={form.default_image_url} alt="" className="mt-2 w-full rounded-lg object-cover" style={{ height: 80 }} />}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">{saving ? t.loading : t.save}</button>
                <button type="button" onClick={() => setEditing(null)} className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Sites / Properties ────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  hotel:      { bg: "#e3f2fd", color: "#1565c0" },
  motel:      { bg: "#e8f5e9", color: "#2e7d32" },
  hostel:     { bg: "#fff3e0", color: "#e65100" },
  resort:     { bg: "#f3e5f5", color: "#6a1b9a" },
  inn:        { bg: "#e0f7fa", color: "#00695c" },
  guesthouse: { bg: "#fce4ec", color: "#880e4f" },
  apartment:  { bg: "#fffde7", color: "#f57f17" },
  "restaurant & bar": { bg: "#ffebee", color: "#c62828" },
  "night club":       { bg: "#ede7f6", color: "#5e35b1" },
  spa:                { bg: "#e0f2f1", color: "#00796b" },
  "beauty salon":     { bg: "#fce4ec", color: "#ad1457" },
};

const FACILITY_ICON: Record<string, string> = {
  restaurant: "🍽️", bar: "🍸", nightclub: "🪩", pool: "🏊", spa: "💆", gym: "🏋️",
  beauty_salon: "💇", elevator: "🛗", parking: "🅿️", wifi: "📶", conference: "📋",
  laundry: "👕", room_service: "🛎️", airport_shuttle: "🚌",
  garden: "🌳", terrace: "🌅",
};

const EMPTY_PROP = {
  name: "", type: "hotel", address: "", city: "", country: "", phone: "", email: "",
  floor_min: 0, floor_max: 0, floors: [] as FloorEntry[], facilities: [] as FacilityEntry[],
};

function PropertiesTab({ t }: { t: any }) {
  const { lang } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [propTypes, setPropTypes] = useState<any[]>([]);
  const [facilityList, setFacilityList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_PROP);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [props, types, facs] = await Promise.all([
        api.getProperties(),
        api.getLookup("property_type"),
        api.getLookup("facility"),
      ]);
      setItems(props);
      setPropTypes(types);
      setFacilityList(facs);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_PROP, facilities: [] }); setShowModal(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name, type: p.type, address: p.address || "", city: p.city || "",
      country: p.country || "", phone: p.phone || "", email: p.email || "",
      floor_min: p.floor_min ?? 0, floor_max: p.floor_max ?? 0,
      floors: parseFloors(p.floors),
      facilities: parseFacilities(p.facilities),
    });
    setShowModal(true);
  };

  const toggleFacility = (code: string) => {
    setForm(f => ({
      ...f,
      facilities: f.facilities.some(x => x.code === code)
        ? f.facilities.filter(x => x.code !== code)
        : [...f.facilities, { code, floor: null }],
    }));
  };

  const setFacilityFloor = (code: string, floor: number | null) => {
    setForm(f => ({ ...f, facilities: f.facilities.map(x => x.code === code ? { ...x, floor } : x) }));
  };

  const setFloorLabel = (floor: number, label: string) => {
    setForm(f => {
      const rest = f.floors.filter(x => x.floor !== floor);
      return { ...f, floors: label.trim() === "" ? rest : [...rest, { floor, label }] };
    });
  };
  const floorLabel = (floor: number) => form.floors.find(x => x.floor === floor)?.label ?? "";

  // The site's floors, e.g. -1, 0, 1 … 4 (capped to a sane count)
  const floorRange: number[] = [];
  for (let fl = Number(form.floor_min); fl <= Number(form.floor_max) && floorRange.length < 60; fl++) floorRange.push(fl);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        floor_min: Number(form.floor_min),
        floor_max: Number(form.floor_max),
        floors: JSON.stringify(form.floors),
        facilities: JSON.stringify(form.facilities),
      };
      if (editing) await api.updateProperty(editing.id, payload);
      else await api.createProperty(payload);
      setShowModal(false); setEditing(null); load();
    } finally { setSaving(false); }
  };

  const handleSetDefault = async (p: any) => {
    await api.updateProperty(p.id, { is_default: true });
    load();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.deleteProperty(confirmDelete.id);
      setConfirmDelete(null); load();
    } catch (err: any) {
      toast(err.message || t.cannot_delete_default_property, "error");
      setConfirmDelete(null);
    }
  };

  const typeLabel = (type: string) => {
    const found = propTypes.find(p => p.value_en === type);
    if (found) return lang === "fr" ? found.value_fr : found.value_en;
    return type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t.sites_desc}</p>
        <button onClick={openCreate}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shrink-0 ml-4">
          + {t.add_property}
        </button>
      </div>

      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
            <tr>
              {[t.property_name, t.property_type, t.city, t.country, t.facilities, t.status, ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.loading}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "var(--muted)" }}>{t.no_data}</td></tr>
            ) : items.map((p, i) => {
              const ts = TYPE_COLORS[p.type] || TYPE_COLORS.hotel;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{p.name}</span>
                      {p.is_default && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "#e8f5e9", color: "#2e7d32" }}>{t.default_label}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold capitalize" style={{ background: ts.bg, color: ts.color }}>
                      {typeLabel(p.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>{p.city || "—"}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>{p.country || "—"}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const facs = parseFacilities(p.facilities);
                      return facs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {facs.slice(0, 5).map(f => (
                            <span key={f.code}
                              title={f.floor !== null ? `${f.code} · ${t.floor_label} ${f.floor}` : f.code}
                              className="text-base">{FACILITY_ICON[f.code] || "✓"}</span>
                          ))}
                          {facs.length > 5 && <span className="text-xs" style={{ color: "var(--muted)" }}>+{facs.length - 5}</span>}
                        </div>
                      ) : <span style={{ color: "var(--muted)" }}>—</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={p.is_active ? { background: "#e8f5e9", color: "#2e7d32" } : { background: "#f5f5f5", color: "#999" }}>
                      {p.is_active ? t.active_status : t.inactive_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(p)}
                        className="text-xs border px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                        style={{ borderColor: "var(--border)", color: "#1565c0" }}>{t.edit}</button>
                      {!p.is_default && (
                        <button onClick={() => handleSetDefault(p)}
                          className="text-xs border px-2.5 py-1 rounded-lg hover:bg-green-50 transition-colors"
                          style={{ borderColor: "#a7f3d0", color: "#059669" }}>{t.set_default}</button>
                      )}
                      {!p.is_default && (
                        <button onClick={() => setConfirmDelete(p)}
                          className="text-xs border px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ borderColor: "#fca5a5", color: "#dc2626" }}>{t.delete}</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <Modal maxWidth="max-w-lg" title={editing ? t.edit_property : t.add_property}
          onClose={() => { setShowModal(false); setEditing(null); }}>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="field-label">{t.property_name}</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="field-input" autoFocus />
                </div>
                <div className="col-span-2">
                  <label className="field-label">{t.property_type}</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {propTypes.map(pt => {
                      const ts = TYPE_COLORS[pt.value_en] || { bg: "var(--input-bg)", color: "var(--text)" };
                      const active = form.type === pt.value_en;
                      return (
                        <button key={pt.value_en} type="button"
                          onClick={() => setForm(f => ({ ...f, type: pt.value_en }))}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors"
                          style={active ? { borderColor: ts.color, background: ts.bg, color: ts.color } : { borderColor: "var(--border)", color: "var(--muted)" }}>
                          {lang === "fr" ? pt.value_fr : pt.value_en}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="field-label">{t.address}</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.city}</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.country}</label>
                  <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.phone}</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.email}</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.lowest_floor}</label>
                  <input type="number" value={form.floor_min}
                    onChange={e => setForm(f => ({ ...f, floor_min: Number(e.target.value) }))} className="field-input" />
                </div>
                <div>
                  <label className="field-label">{t.highest_floor}</label>
                  <input type="number" value={form.floor_max}
                    onChange={e => setForm(f => ({ ...f, floor_max: Number(e.target.value) }))} className="field-input" />
                </div>
                <p className="col-span-2 text-xs -mt-2" style={{ color: "var(--muted)" }}>
                  {t.site_floors}: {t.floors_hint}
                </p>
              </div>

              {/* Building layout — how the site is built, floor by floor */}
              {floorRange.length > 0 && (
                <div>
                  <label className="field-label">{t.building_layout}</label>
                  <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{t.building_layout_desc}</p>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                    {[...floorRange].reverse().map((fl, i) => {
                      const here = form.facilities.filter(x => x.floor === fl);
                      return (
                        <div key={fl} className="flex items-center gap-3 px-3 py-2"
                          style={{
                            borderBottom: i < floorRange.length - 1 ? "1px solid var(--border)" : "none",
                            background: fl < 0 ? "var(--input-bg)" : "transparent",
                          }}>
                          <span className="w-16 shrink-0 text-xs font-black" style={{ color: fl < 0 ? "var(--muted)" : "var(--blue)" }}>
                            {t.floor_label} {fl}
                          </span>
                          <input value={floorLabel(fl)} onChange={e => setFloorLabel(fl, e.target.value)}
                            placeholder={t.floor_name_placeholder}
                            className="field-input" style={{ flex: 1, marginTop: 0 }} />
                          <div className="flex gap-1 shrink-0">
                            {here.map(x => (
                              <span key={x.code} title={x.code} className="text-base">{FACILITY_ICON[x.code] || "✓"}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Facilities */}
              {facilityList.length > 0 && (
                <div>
                  <label className="field-label">{t.facilities}</label>
                  <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>{t.facilities_desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {facilityList.map(fac => {
                      const active = form.facilities.some(x => x.code === fac.value_en);
                      const icon = FACILITY_ICON[fac.value_en] || "✓";
                      return (
                        <button key={fac.value_en} type="button"
                          onClick={() => toggleFacility(fac.value_en)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                          style={active
                            ? { borderColor: "var(--blue)", background: "#e3f2fd", color: "var(--blue)" }
                            : { borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }}>
                          <span>{icon}</span>
                          {lang === "fr" ? fac.value_fr : fac.value_en}
                        </button>
                      );
                    })}
                  </div>

                  {/* Where each enabled facility is located (e.g. Restaurant → Floor 0) */}
                  {form.facilities.length > 0 && (
                    <div className="rounded-xl border p-3 mt-3 space-y-2"
                      style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                        {t.facility_locations}
                      </p>
                      {form.facilities.map(entry => {
                        const fac = facilityList.find(x => x.value_en === entry.code);
                        const label = fac ? (lang === "fr" ? fac.value_fr : fac.value_en) : entry.code;
                        return (
                          <div key={entry.code} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text)" }}>
                              <span>{FACILITY_ICON[entry.code] || "✓"}</span>
                              {label}
                            </span>
                            <select value={entry.floor ?? ""}
                              onChange={e => setFacilityFloor(entry.code, e.target.value === "" ? null : Number(e.target.value))}
                              className="field-input" style={{ width: 140, marginTop: 0 }}>
                              <option value="">— {t.no_floor_set} —</option>
                              {floorRange.map(fl => (
                                <option key={fl} value={fl}>{t.floor_label} {fl}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                  {saving ? t.loading : t.save}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setEditing(null); }}
                  className="flex-1 py-2 rounded-lg text-sm border hover:bg-gray-50"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              </div>
            </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <ConfirmDialog
          title={`${t.delete} ${confirmDelete.name}?`}
          message={t.confirm_delete}
          confirmLabel={t.delete}
          cancelLabel={t.cancel}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── Tab: F&B ──────────────────────────────────────────────────────────────────

function FnBTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "fnb");
  const f = (k: string) => form[`fnb.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`fnb.${k}`, v);

  return (
    <div className="space-y-5">
      <Section title={t.fnb_taxes_section}>
        <Row label={t.fnb_tax_rate}>
          <Input value={f("tax_rate")} onChange={s("tax_rate")} type="number" placeholder="0" />
        </Row>
        <Row label={t.fnb_service_charge}>
          <Input value={f("service_charge")} onChange={s("service_charge")} type="number" placeholder="0" />
        </Row>
      </Section>

      <Section title={t.fnb_orders_section}>
        <Row label={t.fnb_order_prefix} hint={t.fnb_order_prefix_hint}>
          <Input value={f("order_prefix")} onChange={s("order_prefix")} placeholder="ORD-" />
        </Row>
        <Row label={t.fnb_prep_time}>
          <Input value={f("prep_time_minutes")} onChange={s("prep_time_minutes")} type="number" placeholder="15" />
        </Row>
        <Row label={t.fnb_auto_confirm} hint={t.fnb_auto_confirm_hint}>
          <Toggle value={f("auto_confirm_orders")} onChange={s("auto_confirm_orders")} />
        </Row>
      </Section>

      <Section title={t.fnb_services_section}>
        <Row label={t.fnb_table_service}>
          <Toggle value={f("table_service")} onChange={s("table_service")} />
        </Row>
        <Row label={t.fnb_takeaway}>
          <Toggle value={f("takeaway")} onChange={s("takeaway")} />
        </Row>
        <Row label={t.fnb_delivery}>
          <Toggle value={f("delivery")} onChange={s("delivery")} />
        </Row>
      </Section>

      <Section title={t.fnb_printing_section}>
        <Row label={t.fnb_receipt_auto_print} hint={t.fnb_receipt_auto_print_hint}>
          <Toggle value={f("receipt_auto_print")} onChange={s("receipt_auto_print")} />
        </Row>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Sales ─────────────────────────────────────────────────────────────────

function SalesTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "sales");
  const f = (k: string) => form[`sales.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`sales.${k}`, v);

  return (
    <div className="space-y-5">
      <Section title={t.sales_commission_section}>
        <Row label={t.sales_default_commission} hint={t.sales_default_commission_hint}>
          <Input value={f("default_commission_pct")} onChange={s("default_commission_pct")} type="number" placeholder="10" />
        </Row>
        <Row label={t.sales_payment_terms}>
          <Input value={f("agent_payment_terms_days")} onChange={s("agent_payment_terms_days")} type="number" placeholder="30" />
        </Row>
      </Section>

      <Section title={t.sales_packages_section}>
        <Row label={t.sales_package_min_nights}>
          <Input value={f("package_min_nights")} onChange={s("package_min_nights")} type="number" placeholder="1" />
        </Row>
        <Row label={t.sales_quote_validity}>
          <Input value={f("quote_validity_days")} onChange={s("quote_validity_days")} type="number" placeholder="7" />
        </Row>
        <Row label={t.sales_allow_overbooking}>
          <Toggle value={f("allow_package_overbooking")} onChange={s("allow_package_overbooking")} />
        </Row>
      </Section>

      <Section title={t.sales_deposit_section}>
        <Row label={t.sales_deposit_required}>
          <Toggle value={f("deposit_required")} onChange={s("deposit_required")} />
        </Row>
        {f("deposit_required") === "true" && (
          <Row label={t.sales_deposit_pct}>
            <Input value={f("deposit_pct")} onChange={s("deposit_pct")} type="number" placeholder="30" />
          </Row>
        )}
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: HRM ──────────────────────────────────────────────────────────────────

const PAYROLL_CYCLES = ["monthly", "biweekly", "weekly"] as const;

function HRMTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "hrm");
  const f = (k: string) => form[`hrm.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`hrm.${k}`, v);

  const cycleLabel: Record<string, string> = {
    monthly:  t.hrm_payroll_monthly,
    biweekly: t.hrm_payroll_biweekly,
    weekly:   t.hrm_payroll_weekly,
  };

  return (
    <div className="space-y-5">
      <Section title={t.hrm_schedule_section}>
        <Row label={t.hrm_work_hours}>
          <Input value={f("work_hours_per_day")} onChange={s("work_hours_per_day")} type="number" placeholder="8" />
        </Row>
        <Row label={t.hrm_work_days}>
          <Input value={f("work_days_per_week")} onChange={s("work_days_per_week")} type="number" placeholder="5" />
        </Row>
        <Row label={t.hrm_shift_start}>
          <Input value={f("default_shift_start")} onChange={s("default_shift_start")} type="time" />
        </Row>
        <Row label={t.hrm_shift_end}>
          <Input value={f("default_shift_end")} onChange={s("default_shift_end")} type="time" />
        </Row>
      </Section>

      <Section title={t.hrm_overtime_section}>
        <Row label={t.hrm_overtime_threshold} hint={t.hrm_overtime_threshold_hint}>
          <Input value={f("overtime_threshold_hours")} onChange={s("overtime_threshold_hours")} type="number" placeholder="8" />
        </Row>
        <Row label={t.hrm_overtime_multiplier} hint={t.hrm_overtime_multiplier_hint}>
          <Input value={f("overtime_rate_multiplier")} onChange={s("overtime_rate_multiplier")} type="number" placeholder="1.5" />
        </Row>
      </Section>

      <Section title={t.hrm_payroll_section}>
        <Row label={t.hrm_payroll_cycle}>
          <div className="flex gap-2">
            {PAYROLL_CYCLES.map(cycle => (
              <button key={cycle} type="button" onClick={() => s("payroll_cycle")(cycle)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all"
                style={f("payroll_cycle") === cycle
                  ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {cycleLabel[cycle]}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t.hrm_leave_advance} hint={t.hrm_leave_advance_hint}>
          <Input value={f("leave_advance_days")} onChange={s("leave_advance_days")} type="number" placeholder="7" />
        </Row>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Tab: Reservations ──────────────────────────────────────────────────────────

const RES_SOURCES = ["direct", "phone", "email", "ota", "agent", "walk_in"] as const;

function ReservationsTab({ allSettings, onSaved, t }: { allSettings: S; onSaved: (s: S) => void; t: any }) {
  const { form, set, dirty, saving, save } = useSettingsForm(allSettings, "reservations");
  const f = (k: string) => form[`reservations.${k}`] ?? "";
  const s = (k: string) => (v: string) => set(`reservations.${k}`, v);

  const sourceLabel: Record<string, string> = {
    direct: "Direct", phone: "Phone", email: "Email",
    ota: "OTA", agent: "Agent", walk_in: "Walk-in",
  };

  return (
    <div className="space-y-5">
      <Section title={t.res_checkin_section}>
        <Row label={t.res_require_id}>
          <Toggle value={f("require_id_at_checkin")} onChange={s("require_id_at_checkin")} />
        </Row>
        <Row label={t.res_allow_walkin}>
          <Toggle value={f("allow_walkin")} onChange={s("allow_walkin")} />
        </Row>
        <Row label={t.res_confirm_on_create} hint={t.res_confirm_on_create_hint}>
          <Toggle value={f("confirm_on_create")} onChange={s("confirm_on_create")} />
        </Row>
        <Row label={t.res_max_advance}>
          <Input value={f("max_advance_days")} onChange={s("max_advance_days")} type="number" placeholder="365" />
        </Row>
      </Section>

      <Section title={t.res_deposit_section}>
        <Row label={t.res_collect_deposit}>
          <Toggle value={f("collect_deposit")} onChange={s("collect_deposit")} />
        </Row>
        {f("collect_deposit") === "true" && (
          <Row label={t.res_deposit_pct}>
            <Input value={f("deposit_pct")} onChange={s("deposit_pct")} type="number" placeholder="30" />
          </Row>
        )}
      </Section>

      <Section title={t.res_source_section}>
        <Row label={t.res_default_source}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {RES_SOURCES.map(src => (
              <button key={src} type="button" onClick={() => s("default_source")(src)}
                className="py-2 px-3 rounded-lg text-xs font-semibold border transition-all"
                style={f("default_source") === src
                  ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" }
                  : { borderColor: "var(--border)", color: "var(--muted)" }}>
                {sourceLabel[src]}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Section title={t.res_receipt_section}>
        <Row label={t.res_guest_receipt_print}>
          <Toggle value={f("guest_receipt_print")} onChange={s("guest_receipt_print")} />
        </Row>
      </Section>

      <SaveBar dirty={dirty} saving={saving} onSave={() => save(onSaved)} t={t} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; icon: string; labelKey: string }[] = [
  { key: "sites",          icon: "🏢", labelKey: "tab_sites" },
  { key: "hotel",          icon: "🏨", labelKey: "tab_hotel" },
  { key: "policies",       icon: "📋", labelKey: "tab_policies" },
  { key: "billing",        icon: "💳", labelKey: "tab_billing" },
  { key: "reservations",   icon: "📅", labelKey: "tab_reservations" },
  { key: "housekeeping",   icon: "🧹", labelKey: "tab_housekeeping" },
  { key: "maintenance",    icon: "🔧", labelKey: "tab_maintenance" },
  { key: "fnb",            icon: "🍽️", labelKey: "tab_fnb" },
  { key: "sales",          icon: "📈", labelKey: "tab_sales" },
  { key: "hrm",            icon: "👥", labelKey: "tab_hrm" },
  { key: "keycards",       icon: "🔑", labelKey: "tab_keycards_settings" },
  { key: "notifications",  icon: "🔔", labelKey: "tab_notifications" },
  { key: "folio",          icon: "📝", labelKey: "tab_folio" },
  { key: "dropdowns",      icon: "📊", labelKey: "tab_dropdowns" },
  { key: "roomtypes",      icon: "🛏️", labelKey: "tab_room_types_tab" },
];

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("sites");
  const [allSettings, setAllSettings] = useState<S>({});
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    api.getSettings().then(data => { setAllSettings(data); setLoadingSettings(false); });
  }, []);

  const onSaved = (updated: S) => setAllSettings(updated);

  const tabProps = { allSettings, onSaved, t, lang };

  return (
    <div>
      <h2 className="mb-5" style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.settings}</h2>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-start">
        {/* Left sidebar — horizontal scroll strip on mobile */}
        <nav className="shrink-0 card flex overflow-x-auto gap-1 lg:block lg:w-52 lg:space-y-0.5" style={{ padding: "8px" }}>
          {TABS.map(tb => {
            const isActive = tab === tb.key;
            return (
              <button key={tb.key} onClick={() => setTab(tb.key)}
                className="shrink-0 whitespace-nowrap lg:w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors"
                style={isActive
                  ? { background: "#e3f2fd", color: "var(--blue)" }
                  : { color: "var(--muted)" }}>
                <span style={{ fontSize: 16 }}>{tb.icon}</span>
                {t[tb.labelKey as keyof typeof t] as string}
              </button>
            );
          })}
        </nav>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {loadingSettings ? (
            <div className="card text-center py-16 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
          ) : (
            <>
              {tab === "sites"          && <PropertiesTab t={t} />}
              {tab === "hotel"         && <HotelTab {...tabProps} />}
              {tab === "policies"      && <PoliciesTab {...tabProps} />}
              {tab === "billing"       && <BillingTab {...tabProps} />}
              {tab === "housekeeping"  && <HousekeepingTab {...tabProps} />}
              {tab === "maintenance"   && <MaintenanceTab {...tabProps} />}
              {tab === "reservations"  && <ReservationsTab {...tabProps} />}
              {tab === "fnb"           && <FnBTab {...tabProps} />}
              {tab === "sales"         && <SalesTab {...tabProps} />}
              {tab === "hrm"           && <HRMTab {...tabProps} />}
              {tab === "keycards"      && <KeyCardsTab {...tabProps} />}
              {tab === "notifications" && <NotificationsTab {...tabProps} />}
              {tab === "folio"         && <FolioTab t={t} />}
              {tab === "dropdowns"     && <DropdownsTab t={t} />}
              {tab === "roomtypes"     && <RoomTypesTab t={t} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
