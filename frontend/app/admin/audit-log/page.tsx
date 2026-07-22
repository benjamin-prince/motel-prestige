"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

const PAGE_SIZE = 50;

const ENTITY_FILTERS = [
  { key: "",             labelKey: "all_types" },
  { key: "reservation",  labelKey: "et_reservation" },
  { key: "keycard",      labelKey: "et_keycard" },
  { key: "room",         labelKey: "et_room" },
  { key: "payment",      labelKey: "et_payment" },
  { key: "guest",        labelKey: "et_guest" },
  { key: "billing",      labelKey: "et_billing" },
] as const;

function formatDate(iso: string, lang: string) {
  const d = new Date(iso);
  return d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function groupByDay(entries: any[], lang: string): { label: string; items: any[] }[] {
  const map = new Map<string, any[]>();
  for (const e of entries) {
    const d = new Date(e.created_at);
    const key = d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function AuditLogPage() {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef(0);

  const fetchPage = useCallback(async (
    reset: boolean,
    opts: { entity_type?: string; search?: string }
  ) => {
    const skip = reset ? 0 : skipRef.current;
    if (reset) { setLoading(true); } else { setLoadingMore(true); }
    try {
      const data = await api.getActivityLog({
        limit: PAGE_SIZE,
        skip,
        entity_type: opts.entity_type || undefined,
        search: opts.search || undefined,
      });
      if (reset) {
        setEntries(data);
        skipRef.current = data.length;
      } else {
        setEntries(prev => [...prev, ...data]);
        skipRef.current += data.length;
      }
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + re-fetch on filter change
  useEffect(() => {
    skipRef.current = 0;
    fetchPage(true, { entity_type: entityFilter, search });
  }, [entityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      skipRef.current = 0;
      fetchPage(true, { entity_type: entityFilter, search });
    }, 350);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = () => fetchPage(false, { entity_type: entityFilter, search });

  const groups = groupByDay(entries, lang);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.audit_log}</h2>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ background: "var(--input-bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          {entries.length} {lang === "fr" ? "entrées" : "entries"}
        </span>
      </div>

      {/* Filter bar */}
      <div className="card flex flex-wrap items-center gap-3" style={{ padding: "12px 16px" }}>
        <div className="flex items-center gap-1 flex-wrap">
          {ENTITY_FILTERS.map(f => {
            const active = entityFilter === f.key;
            return (
              <button key={f.key} onClick={() => setEntityFilter(f.key)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-colors"
                style={active
                  ? { background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" }
                  : { background: "transparent", color: "var(--muted)", borderColor: "var(--border)" }}>
                {t[f.labelKey as keyof typeof t] as string}
              </button>
            );
          })}
        </div>
        <div className="ml-auto relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search_events}
            className="field-input pl-8 py-1.5 text-sm w-56"
            style={{ paddingLeft: 30 }}
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--muted)" }}>🔍</span>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="card text-center py-16 text-sm" style={{ color: "var(--muted)" }}>{t.loading}</div>
      ) : entries.length === 0 ? (
        <div className="card text-center py-16 text-sm" style={{ color: "var(--muted)" }}>{t.no_activity}</div>
      ) : (
        <div className="card" style={{ padding: "24px 28px" }}>
          {groups.map((group, gi) => (
            <div key={gi} className="mb-6">
              {/* Day header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-semibold uppercase tracking-wider capitalize"
                  style={{ color: "var(--muted)" }}>{group.label}</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              {/* Events */}
              <div className="space-y-0">
                {group.items.map((entry, ei) => {
                  const isLast = ei === group.items.length - 1;
                  const msg = lang === "fr" ? entry.message_fr : entry.message_en;
                  return (
                    <div key={entry.id} className="flex gap-4 relative">
                      {/* Spine line */}
                      {!isLast && (
                        <div className="absolute left-4 top-8 bottom-0 w-px"
                          style={{ background: "var(--border)" }} />
                      )}

                      {/* Icon bubble */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 z-10"
                        style={{ background: entry.color + "20", border: `2px solid ${entry.color}30` }}>
                        <span style={{ fontSize: 14 }}>{entry.icon}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{msg}</p>
                          <span className="text-xs shrink-0 mt-0.5" style={{ color: "var(--muted)" }}>
                            {formatDate(entry.created_at, lang)}
                          </span>
                        </div>
                        {entry.entity_type && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full capitalize"
                            style={{ background: "var(--input-bg)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                            {entry.entity_type}
                            {entry.entity_id ? ` #${entry.entity_id}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button onClick={loadMore} disabled={loadingMore}
                className="px-5 py-2 rounded-lg text-sm border font-semibold transition-colors hover:bg-gray-50 disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {loadingMore ? t.loading : t.load_more}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
