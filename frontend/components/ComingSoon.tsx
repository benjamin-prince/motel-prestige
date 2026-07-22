"use client";
import { useI18n } from "@/lib/i18n";
import type { Translations } from "@/lib/translations/en";

export default function ComingSoon({ tKey }: { tKey: keyof Translations }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-24" style={{ color: "var(--muted)" }}>
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>{t[tKey] as string}</h2>
      <p className="text-sm">{t.coming_soon}</p>
    </div>
  );
}
