"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useNavSections, isNavActive } from "@/lib/nav";

export const OPEN_PALETTE_EVENT = "open-command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}

// Loose subsequence match so "nau" still finds "Night Audit".
function matches(query: string, text: string): boolean {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const s = text.toLowerCase();
  if (s.includes(query.toLowerCase().trim())) return true;
  let i = 0;
  for (const ch of s) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

export default function CommandPalette() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sections = useNavSections();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    const flat = sections.flatMap(s =>
      s.children.map(c => ({ section: s.label, icon: s.icon, label: c.label, href: c.href }))
    );
    if (!query.trim()) return flat;
    return flat.filter(i => matches(query, `${i.section} ${i.label}`) || matches(query, i.label));
  }, [sections, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Focus after the dialog renders.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setSelected(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && items[selected]) { e.preventDefault(); go(items[selected].href); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  };

  // Group filtered items by section for display, preserving order.
  const groups: { section: string; icon: string; items: { label: string; href: string; index: number }[] }[] = [];
  items.forEach((item, index) => {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push({ ...item, index });
    else groups.push({ section: item.section, icon: item.icon, items: [{ ...item, index }] });
  });

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[12vh] px-6"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(2px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-modal="true"
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--card)", border: "1px solid var(--border)", maxHeight: "60vh", animation: "modal-in 0.18s ease" }}>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <svg className="w-4.5 h-4.5 shrink-0" style={{ color: "var(--muted)", width: 18, height: 18 }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={t.cmd_search_placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text)" }}
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              {t.cmd_no_results} “{query}”
            </div>
          ) : groups.map(g => (
            <div key={g.section}>
              <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: "var(--muted)" }}>
                <span className="text-sm">{g.icon}</span> {g.section}
              </div>
              {g.items.map(item => {
                const isSel = item.index === selected;
                const isCurrent = isNavActive(pathname, item.href);
                return (
                  <button
                    key={item.href + item.label}
                    data-index={item.index}
                    onClick={() => go(item.href)}
                    onMouseMove={() => setSelected(item.index)}
                    className="w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-colors"
                    style={isSel
                      ? { background: "var(--blue-light)", color: "var(--blue)", fontWeight: 600 }
                      : { color: "var(--text)" }}>
                    <span>{item.label}</span>
                    <span className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--blue)" }} />
                      )}
                      {isSel && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t text-xs shrink-0"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--input-bg)" }}>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>↑↓</kbd>
            {t.cmd_hint_navigate}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded font-mono" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>↵</kbd>
            {t.cmd_hint_open}
          </span>
        </div>
      </div>
    </div>
  );
}
