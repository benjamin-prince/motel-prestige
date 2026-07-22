"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import Link from "next/link";
import { SkeletonCards } from "@/components/ui";

const GROUP_ICONS: Record<string, string> = {
  "id_type": "🪪", "gender": "👤", "nationality": "🌍", "title": "🎩",
  "room_view": "🪟", "room_floor": "🏢", "bed_type": "🛏️", "room_feature": "⭐",
  "payment_method": "💳", "source": "📣", "guest_type": "👥", "meal_plan": "🍽️",
  "reservation_status": "📋", "room_status": "🔑", "housekeeping_status": "🧹",
  "maintenance_type": "🔧", "lost_found_status": "🔎", "task_priority": "🚨",
};

export default function ReferencePage() {
  const { t, lang } = useI18n();
  const [lookups, setLookups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    api.getAllLookups(true).then(data => {
      setLookups(data);
      const groups = [...new Set(data.map((l: any) => l.group).filter(Boolean))].sort();
      if (groups.length > 0) setActiveGroup(groups[0] as string);
    }).finally(() => setLoading(false));
  }, []);

  const groups = [...new Set(lookups.map(l => l.group).filter(Boolean))].sort() as string[];
  const activeItems = activeGroup ? lookups.filter(l => l.group === activeGroup) : [];
  const groupLabel = (g: string) => (g || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="page-title">{t.fo_ref_title}</h2>
          <p className="page-subtitle">{t.fo_ref_desc}</p>
        </div>
        <Link href="/admin/settings"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          ⚙️ {t.fo_go_to_settings}
        </Link>
      </div>

      {loading ? (
        <SkeletonCards count={9} height={64} className="grid grid-cols-1 sm:grid-cols-3 gap-4" />
      ) : (
        <div className="flex gap-5">
          {/* Groups sidebar */}
          <div className="w-56 shrink-0 space-y-1">
            {groups.map(g => {
              const cnt = lookups.filter(l => l.group === g).length;
              return (
                <button key={g} onClick={() => setActiveGroup(g)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                  style={activeGroup === g
                    ? { background: "linear-gradient(135deg,#3b5bdb,#4c6ef5)", color: "#fff" }
                    : { color: "var(--text)", background: "transparent" }}>
                  <span>{GROUP_ICONS[g] || "📌"}</span>
                  <span className="flex-1 font-medium truncate">{groupLabel(g)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 font-bold"
                    style={activeGroup === g
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: "var(--input-bg)", color: "var(--muted)" }}>
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Items panel */}
          <div className="flex-1 card" style={{ padding: 0 }}>
            {activeGroup && (
              <>
                <div className="flex items-center justify-between px-5 py-4 border-b"
                  style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{GROUP_ICONS[activeGroup] || "📌"}</span>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "var(--text)" }}>
                        {groupLabel(activeGroup)}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {activeItems.length} {t.fo_items_count}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {activeItems.map((item, i) => (
                    <div key={item.id}
                      className="flex items-center px-5 py-3 gap-4"
                      style={{ background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "var(--input-bg)", color: "var(--muted)" }}>
                        {i + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                            style={{ color: "var(--muted)" }}>EN</p>
                          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                            {item.value_en}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                            style={{ color: "var(--muted)" }}>FR</p>
                          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                            {item.value_fr}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={item.is_active !== false
                          ? { background: "#dcfce7", color: "#059669" }
                          : { background: "#f3f4f6", color: "#9ca3af" }}>
                        {item.is_active !== false
                          ? (lang === "fr" ? "Actif" : "Active")
                          : (lang === "fr" ? "Inactif" : "Inactive")}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
