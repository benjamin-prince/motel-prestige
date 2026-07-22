"use client";
import { useI18n } from "@/lib/i18n";

const PLANNED_FEATURES = [
  { icon: "📅", en: "Monthly, quarterly and annual PM task templates per room category", fr: "Modèles de tâches MP mensuelles, trimestrielles et annuelles par catégorie de chambre" },
  { icon: "🔄", en: "Recurring work order auto-generation based on defined intervals",   fr: "Génération automatique d'ordres de travail récurrents selon des intervalles définis" },
  { icon: "📊", en: "PM compliance dashboard — completed vs overdue vs scheduled",       fr: "Tableau de bord de conformité PM — effectué / en retard / planifié" },
  { icon: "🛠️", en: "Equipment register with maintenance history per room / asset",      fr: "Registre d'équipements avec historique de maintenance par chambre / actif" },
  { icon: "🔔", en: "Advance notifications to technicians before due dates",             fr: "Notifications anticipées aux techniciens avant les échéances" },
  { icon: "📤", en: "Export PM schedule to PDF or printable checklist",                  fr: "Export du calendrier PM en PDF ou liste de contrôle imprimable" },
];

const PREVIEW_SCHEDULE = [
  { interval: "Monthly",   en: "AC filter cleaning",               fr: "Nettoyage filtre climatiseur",       icon: "❄️", color: "#3b82f6" },
  { interval: "Monthly",   en: "Fire extinguisher check",          fr: "Vérification extincteurs",           icon: "🔥", color: "#ef4444" },
  { interval: "Quarterly", en: "Plumbing inspection",              fr: "Inspection plomberie",               icon: "🚿", color: "#0891b2" },
  { interval: "Quarterly", en: "Electrical panel review",          fr: "Révision tableau électrique",        icon: "⚡", color: "#f59e0b" },
  { interval: "Annual",    en: "Deep structural inspection",       fr: "Inspection structurelle approfondie",icon: "🏗️", color: "#7c3aed" },
  { interval: "Annual",    en: "Full HVAC service & certification",fr: "Révision HVAC complète & certification", icon: "🌡️", color: "#059669" },
];

const INTERVAL_COLOR: Record<string, string> = {
  Monthly: "#3b5bdb", Quarterly: "#059669", Annual: "#d97706",
};

export default function MaintenanceSchedulePage() {
  const { t, lang } = useI18n();

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">{t.pm_title}</h2>
        <p className="page-subtitle">{t.pm_desc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Planned module card */}
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg,#7c3aed,#8b5cf6)" }}>
            <span className="text-3xl">📅</span>
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>{t.fo_planned_label}</h3>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>{t.fo_planned_desc}</p>

          <div className="text-left mb-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
              {t.fo_feature_preview}
            </p>
            <div className="space-y-2">
              {PLANNED_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: "var(--input-bg)" }}>
                  <span className="text-lg shrink-0">{f.icon}</span>
                  <p className="text-sm text-left" style={{ color: "var(--text)" }}>
                    {lang === "fr" ? f.fr : f.en}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "#faf5ff", border: "1px solid #d8b4fe", color: "#7c3aed" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8b5cf6" }} />
            {lang === "fr" ? "Développement planifié" : "Planned Development"}
          </div>
        </div>

        {/* Preview of what the schedule will look like */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
            {lang === "fr" ? "Aperçu du Calendrier" : "Schedule Preview"}
          </h3>
          <div className="card overflow-hidden" style={{ padding: 0 }}>
            <div className="px-4 py-3 border-b flex items-center gap-2"
              style={{ borderColor: "var(--border)", background: "var(--input-bg)" }}>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                {lang === "fr" ? "Exemples de tâches préventives" : "Example preventive tasks"}
              </span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "#faf5ff", color: "#7c3aed", border: "1px solid #d8b4fe" }}>
                {lang === "fr" ? "Aperçu" : "Preview"}
              </span>
            </div>
            {PREVIEW_SCHEDULE.map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3"
                style={{ borderBottom: i < PREVIEW_SCHEDULE.length - 1 ? "1px solid var(--border)" : "none",
                  background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={{ background: item.color + "15" }}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                    {lang === "fr" ? item.fr : item.en}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: (INTERVAL_COLOR[item.interval] || "#6b7280") + "15",
                    color: INTERVAL_COLOR[item.interval] || "#6b7280" }}>
                  {item.interval}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
