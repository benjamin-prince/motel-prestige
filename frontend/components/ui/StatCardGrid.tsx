"use client";

export interface StatCardItem {
  label: string;
  value: number | string;
  gradient: string;   // legacy field — first hex is reused as the icon accent
  icon?: string;
  delta?: string;     // optional trend line, e.g. "▲ 12% vs hier"
  deltaUp?: boolean;
}

/** Accent = the first solid colour found in the legacy `gradient` string. */
const accentOf = (g: string) => (g.match(/#[0-9a-fA-F]{6}/) || ["#2f62f6"])[0];

export default function StatCardGrid({ stats, loading = false, className = "grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" }: {
  stats: StatCardItem[];
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {stats.map(k => {
        const accent = accentOf(k.gradient);
        return (
          <div key={k.label} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{k.label}</span>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: accent + "1f", color: accent }}>{k.icon ?? "●"}</span>
            </div>
            <div className="text-2xl font-extrabold mt-2" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : k.value}
            </div>
            {k.delta && (
              <div className="text-xs font-semibold mt-1" style={{ color: k.deltaUp ? "var(--good)" : "var(--muted)" }}>{k.delta}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
