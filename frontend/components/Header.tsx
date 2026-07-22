"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useProperty } from "@/lib/property-context";
import { openCommandPalette } from "./CommandPalette";

const TYPE_ICON: Record<string, string> = {
  hotel: "🏨", motel: "🏩", hostel: "🛖", resort: "🏖️",
  inn: "🏠", guesthouse: "🏡", apartment: "🏢",
  "restaurant & bar": "🍽️", "night club": "🪩", spa: "💆", "beauty salon": "💇",
};

interface Props {
  user?: Record<string, unknown> | null;
  onSignOut?: () => void;
  /** Opens the sidebar drawer on small screens. */
  onMenu?: () => void;
}

export default function Header({ user, onSignOut, onMenu }: Props) {
  const { lang, setLang, t } = useI18n();
  const { properties, current, setCurrent } = useProperty();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const root = document.documentElement;
    const cur = root.getAttribute("data-theme")
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("ms-theme", next); } catch { /* blocked */ }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.full_name
    ? String(user.full_name).split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "A";
  const displayName = user?.full_name ? String(user.full_name) : "Admin";
  const displayEmail = user?.email ? String(user.email) : "";

  const activeProperties = properties.filter(p => p.is_active);
  const icon = current ? (TYPE_ICON[current.type] || "🏢") : "🏢";

  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-5 shrink-0"
      style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>

      <div className="flex items-center gap-3">
      {/* Hamburger — mobile only */}
      <button onClick={onMenu} aria-label="Menu"
        className="ms-burger items-center justify-center w-9 h-9 rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--muted)" }}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Left: property switcher */}
      <div className="relative" ref={dropRef}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors hover:bg-gray-100"
          style={{ border: "1px solid var(--border)" }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div className="text-left min-w-0">
            <div className="text-sm font-bold leading-tight truncate max-w-[110px] sm:max-w-[200px]" style={{ color: "var(--text)" }}>
              {current?.name ?? "—"}
            </div>
            {current?.city && (
              <div className="hidden sm:block text-xs leading-tight capitalize" style={{ color: "var(--muted)" }}>
                {current.city}{current.country ? `, ${current.country}` : ""}
              </div>
            )}
          </div>
          <svg className="w-3.5 h-3.5 ml-1 transition-transform" style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "none" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-2 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {t.switch_property}
              </p>
            </div>

            <div className="py-1 max-h-64 overflow-y-auto">
              {activeProperties.length === 0 ? (
                <div className="px-4 py-3 text-sm" style={{ color: "var(--muted)" }}>{t.no_properties}</div>
              ) : activeProperties.map(p => {
                const isCurrent = current?.id === p.id;
                const pIcon = TYPE_ICON[p.type] || "🏢";
                return (
                  <button key={p.id}
                    onClick={() => { setCurrent(p); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-50">
                    <span className="text-xl shrink-0">{pIcon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{p.name}</span>
                        {p.is_default && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
                            style={{ background: "#e8f5e9", color: "#2e7d32" }}>
                            {t.default_label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs capitalize" style={{ color: "var(--muted)" }}>
                        {p.type}{p.city ? ` · ${p.city}` : ""}
                      </div>
                    </div>
                    {isCurrent && (
                      <svg className="w-4 h-4 shrink-0" style={{ color: "var(--blue)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => { router.push("/admin/settings"); setOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" style={{ color: "var(--blue)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium" style={{ color: "var(--blue)" }}>{t.manage_properties}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Right: search + lang + bell + user */}
      <div className="flex items-center gap-1.5 sm:gap-4">
        {/* Quick search → command palette */}
        <button onClick={openCommandPalette} title={`${t.cmd_quick_search} (⌘K)`}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--muted)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title="Thème clair / sombre"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--muted)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        {/* Language switcher */}
        <div className="hidden sm:flex items-center gap-1 rounded-lg p-0.5"
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
          {(["en", "fr"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-colors uppercase"
              style={lang === l
                ? { background: "var(--blue)", color: "#fff" }
                : { color: "var(--muted)", background: "transparent" }}>
              {l}
            </button>
          ))}
        </div>

        {/* Bell */}
        <button className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: "var(--muted)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* User + sign out */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
            style={{ background: "var(--blue)" }}>
            {initials}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>{displayName}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{displayEmail}</div>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} title={t.sign_out}
              className="ml-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              style={{ color: "var(--muted)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
