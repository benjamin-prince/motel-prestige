"use client";

export default function SegmentedControl({ options, value, onChange }: {
  options: { value: string; label: string; badge?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={value === o.value ? { background: "var(--blue)", color: "#fff" } : { color: "var(--muted)" }}>
          {o.label}
          {o.badge !== undefined && (
            <span className="text-xs rounded-full px-1.5 py-0.5 font-bold"
              style={value === o.value ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--border)" }}>
              {o.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
