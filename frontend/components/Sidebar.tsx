"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useProperty } from "@/lib/property-context";
import { usePermissions } from "@/lib/permissions";
import { useNavSections, isNavActive } from "@/lib/nav";
import { openCommandPalette } from "./CommandPalette";

const TYPE_ICON: Record<string, string> = {
  hotel: "🏨", motel: "🏩", hostel: "🛖", resort: "🏖️",
  inn: "🏠", guesthouse: "🏡", apartment: "🏢",
  "restaurant & bar": "🍽️", "night club": "🪩", spa: "💆", "beauty salon": "💇",
};

const OPEN_STATE_KEY = "sidebar-open-sections";

interface Props {
  /** Mobile drawer open state (ignored on desktop, where the sidebar is always visible). */
  open?: boolean;
  /** Called when a nav link is tapped or the drawer should close. */
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: Props) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { current } = useProperty();
  const { me } = usePermissions();
  const nav = useNavSections();

  const displayName = me?.full_name || t.nav_app_admin;
  const initials = me?.full_name
    ? me.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "A";
  const roleLabel = me?.role
    ? me.role.split("_").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" ")
    : t.administrator;

  const activeSection = nav.find(s => s.children.some(c => isNavActive(pathname, c.href)));

  const [shortcut, setShortcut] = useState("⌘K");
  useEffect(() => {
    if (!/Mac/i.test(navigator.platform)) setShortcut("Ctrl K");
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(nav.map(s => [s.key, s.defaultOpen ?? false]))
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPEN_STATE_KEY);
      if (saved) setOpenSections(o => ({ ...o, ...JSON.parse(saved) }));
    } catch { /* corrupt state — keep defaults */ }
  }, []);

  useEffect(() => {
    if (activeSection && !openSections[activeSection.key]) {
      setOpenSections(o => ({ ...o, [activeSection.key]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeSection?.key]);

  const toggle = (key: string) =>
    setOpenSections(o => {
      const next = { ...o, [key]: !o[key] };
      try { localStorage.setItem(OPEN_STATE_KEY, JSON.stringify(next)); } catch { /* storage full/blocked */ }
      return next;
    });

  return (
    <aside
      className={`ms-side ${open ? "ms-side-open" : ""} w-60 flex flex-col shrink-0 overflow-y-auto`}
      style={{ background: "var(--sidebar)", borderRight: "1px solid var(--sidebar-line)" }}
    >
      {/* Logo */}
      <div className="px-4 py-4 shrink-0" style={{ borderBottom: "1px solid var(--sidebar-line)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
            style={{ background: "var(--blue)" }}>
            <span>{current ? (TYPE_ICON[current.type] || "🏢") : "🏨"}</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight truncate" style={{ color: "var(--text)" }}>
              {current?.name ?? "Hotel PMS"}
            </div>
            <div className="text-[11px] capitalize truncate" style={{ color: "var(--sidebar-muted)" }}>
              {current?.type ?? "property management"}
            </div>
          </div>
        </div>
      </div>

      {/* Quick search → command palette */}
      <div className="px-3 pt-3 shrink-0">
        <button
          onClick={openCommandPalette}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
          style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--sidebar-muted)" }}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 text-left">{t.cmd_quick_search}</span>
          <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}>{shortcut}</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {nav.map((section) => {
          const isOpen = openSections[section.key] ?? (activeSection?.key === section.key);
          const hasActive = activeSection?.key === section.key;
          return (
            <div key={section.key}>
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors"
                style={{ color: hasActive ? "var(--sidebar-text)" : "var(--sidebar-muted)" }}>
                <span className="flex items-center gap-2">
                  <span>{section.icon}</span>
                  {section.label}
                  {hasActive && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--blue)" }} />
                  )}
                </span>
                <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && (
                <div className="pb-1 px-2">
                  {section.children.map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        onClick={onClose}
                        className="flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg text-[13.5px] transition-colors mb-0.5"
                        style={active
                          ? { background: "var(--sidebar-active-bg)", color: "var(--sidebar-active-text)", fontWeight: 600 }
                          : { color: "var(--sidebar-text)" }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: active ? "var(--sidebar-active-text)" : "var(--border)" }} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--sidebar-line)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: "linear-gradient(135deg,#2f62f6,#8a6bff)" }}>{initials}</div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium truncate" style={{ color: "var(--text)" }}>{displayName}</div>
            <div className="text-[11px] truncate" style={{ color: "var(--sidebar-muted)" }}>{roleLabel}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
