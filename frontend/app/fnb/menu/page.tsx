"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { EmptyState, SearchInput, SkeletonCards } from "@/components/ui";
import { formatAmount } from "@/lib/currency";
import type { Currency } from "@/lib/types";

interface MenuItem {
  id: number; name_en: string; name_fr: string;
  main_category?: string; category: string; subcategory?: string;
  price: number; image_url?: string; is_available: boolean;
}
interface Cat { value_en: string; value_fr: string; parent_value_en?: string }

export default function MenuPage() {
  const { t, lang } = useI18n();

  // Data
  const [items, setItems]           = useState<MenuItem[]>([]);
  const [mainCats, setMainCats]     = useState<Cat[]>([]);
  const [allCats, setAllCats]       = useState<Cat[]>([]);
  const [allSubcats, setAllSubcats] = useState<Cat[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading]       = useState(true);

  // Selection state (3 levels)
  const [main, setMain]     = useState("");        // "Food" | "Boissons" | ""
  const [cat, setCat]       = useState("");        // level-2
  const [subcat, setSubcat] = useState("");        // level-3

  // Display options
  const [view, setView]             = useState<"grid" | "list">("grid");
  const [search, setSearch]         = useState("");
  const [displayCurrency, setDisplayCurrency] = useState("XAF");

  // Derived
  const xafCur: Currency = currencies.find(c => c.code === "XAF") ||
    { id: 0, code: "XAF", name: "Franc CFA BEAC", symbol: "FCFA", xaf_rate: 1, is_default: true, is_active: true };
  const selCur: Currency = currencies.find(c => c.code === displayCurrency) || xafCur;

  const priceDisplay = (xafPrice: number) => {
    if (displayCurrency === "XAF") return formatAmount(xafPrice, xafCur);
    return formatAmount(xafPrice / Number(selCur.xaf_rate), selCur);
  };

  const label = (c: Cat) => lang === "fr" ? c.value_fr : c.value_en;
  const itemName = (i: MenuItem) => lang === "fr" ? i.name_fr : i.name_en;

  // Level-2 cats visible under current main selection
  const visibleCats = main ? allCats.filter(c => c.parent_value_en === main) : allCats;
  // Level-3 subcats visible under current level-2 selection
  const visibleSubcats = cat ? allSubcats.filter(s => s.parent_value_en === cat) : [];

  // Filtered items
  const filtered = items.filter(i => {
    if (main   && i.main_category !== main)   return false;
    if (cat    && i.category      !== cat)    return false;
    if (subcat && i.subcategory   !== subcat) return false;
    if (search && !itemName(i).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Count helpers
  const countMain = (m: string) => items.filter(i => i.main_category === m).length;
  const countCat  = (c: string) => items.filter(i => (!main || i.main_category === main) && i.category === c).length;
  const countSub  = (s: string) => items.filter(i => i.category === cat && i.subcategory === s).length;

  const load = async () => {
    setLoading(true);
    try {
      const [its, mains, cats, subs, curs] = await Promise.all([
        api.getMenuItems(),
        api.getMenuMainCategories(),
        api.getMenuCategories(),
        api.getMenuSubcategories(),
        api.getCurrencies(true),
      ]);
      setItems(its);
      setMainCats(mains);
      setAllCats(cats);
      setAllSubcats(subs);
      setCurrencies(curs);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selectMain = (m: string) => { setMain(m); setCat(""); setSubcat(""); };
  const selectCat  = (c: string) => { setCat(c);   setSubcat(""); };
  const selectSub  = (s: string) => { setSubcat(s); };

  // Label for a category chip (translated from DB)
  const catLabel = (value_en: string, group: Cat[]) => {
    const found = group.find(c => c.value_en === value_en);
    return found ? label(found) : value_en;
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{t.fnb_menu}</h2>
        <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          + {t.add_item}
        </button>
      </div>

      {/* ── Level 1: Food | Boissons ──────────────────────────────────────── */}
      <div className="flex gap-3 mb-4">
        <button onClick={() => selectMain("")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={!main
            ? { background: "var(--blue)", color: "#fff", boxShadow: "0 3px 10px rgba(59,91,219,0.3)" }
            : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          🍽️ {lang === "fr" ? "Tout" : "All"}
          <span className="text-xs rounded-full px-2 font-bold"
            style={!main ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--border)" }}>
            {items.length}
          </span>
        </button>
        {mainCats.map(m => (
          <button key={m.value_en} onClick={() => selectMain(m.value_en)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={main === m.value_en
              ? { background: "var(--blue)", color: "#fff", boxShadow: "0 3px 10px rgba(59,91,219,0.3)" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            {m.value_en === "Food" ? "🍖" : "🥤"} {label(m)}
            <span className="text-xs rounded-full px-2 font-bold"
              style={main === m.value_en ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--border)" }}>
              {countMain(m.value_en)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Level 2: subcategories of selected main ────────────────────────── */}
      {(main || visibleCats.length > 0) && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button onClick={() => selectCat("")}
            className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={!cat
              ? { background: "var(--blue)", color: "#fff" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            {lang === "fr" ? "Tous" : "All"}
            <span className="ml-1.5 text-xs rounded-full px-1 font-bold"
              style={!cat ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--border)" }}>
              {items.filter(i => !main || i.main_category === main).length}
            </span>
          </button>
          {visibleCats.map(c => (
            <button key={c.value_en} onClick={() => selectCat(c.value_en)}
              className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={cat === c.value_en
                ? { background: "var(--blue)", color: "#fff" }
                : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              {label(c)}
              <span className="text-xs rounded-full px-1 font-bold"
                style={cat === c.value_en ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--border)" }}>
                {countCat(c.value_en)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Level 3: subcategory types ─────────────────────────────────────── */}
      {visibleSubcats.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 pl-3">
          <span className="text-xs self-center shrink-0 font-semibold" style={{ color: "var(--muted)" }}>↳</span>
          <button onClick={() => selectSub("")}
            className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-all"
            style={!subcat
              ? { background: "#1a2332", color: "#fff" }
              : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            {lang === "fr" ? "Tous" : "All"} {`(${items.filter(i => i.category === cat).length})`}
          </button>
          {visibleSubcats.map(s => (
            <button key={s.value_en} onClick={() => selectSub(s.value_en)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={subcat === s.value_en
                ? { background: "#1a2332", color: "#fff" }
                : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
              {label(s)}
              <span className="text-xs rounded-full px-1 font-bold"
                style={subcat === s.value_en ? { background: "rgba(255,255,255,0.2)" } : { background: "var(--border)" }}>
                {countSub(s.value_en)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar: search + currency + view toggle ───────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <select value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)}
          className="field-input shrink-0" style={{ width: 130 }}>
          {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.symbol}</option>)}
        </select>
        <SearchInput value={search} onChange={setSearch} placeholder={t.search_menu}
          className="relative flex-1 max-w-sm" />
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {(["grid", "list"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className="p-2 rounded-md transition-colors"
              style={view === v ? { background: "var(--blue)", color: "#fff" } : { color: "var(--muted)" }}>
              {v === "grid"
                ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              }
            </button>
          ))}
        </div>
        {/* Result count */}
        <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
          {filtered.length} {lang === "fr" ? "article(s)" : "item(s)"}
        </span>
      </div>

      {/* ── Items grid / list ──────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonCards count={12} height={165} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" message={t.no_items} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="card overflow-hidden group cursor-pointer hover:shadow-md transition-shadow" style={{ padding: 0 }}>
              <div className="relative overflow-hidden" style={{ height: 120 }}>
                {item.image_url
                  ? <img src={item.image_url} alt={itemName(item)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  : <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: "var(--input-bg)" }}>
                      {item.main_category === "Boissons" ? "🥤" : "🍽️"}
                    </div>
                }
                {!item.is_available && (
                  <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ background: "rgba(0,0,0,0.5)" }}>
                    <span className="text-white text-xs font-bold uppercase">{t.unavailable}</span>
                  </div>
                )}
                {/* Category breadcrumb badge */}
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1"
                  style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
                  <span className="text-white text-xs font-medium">
                    {item.subcategory
                      ? catLabel(item.subcategory, allSubcats)
                      : catLabel(item.category, allCats)}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold mb-1 leading-tight" style={{ color: "var(--text)" }}>
                  {itemName(item)}
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--blue)" }}>
                  {priceDisplay(Number(item.price))}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--input-bg)", borderBottom: "1px solid var(--border)" }}>
              <tr>
                {[t.item, lang === "fr" ? "Catégorie" : "Category", t.price, t.status, ""].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--input-bg)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.image_url
                        ? <img src={item.image_url} alt={itemName(item)} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        : <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: "var(--input-bg)" }}>
                            {item.main_category === "Boissons" ? "🥤" : "🍽️"}
                          </div>
                      }
                      <div>
                        <p className="font-medium leading-tight" style={{ color: "var(--text)" }}>{itemName(item)}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                          {item.main_category && <span>{catLabel(item.main_category, mainCats)} → </span>}
                          {catLabel(item.category, allCats)}
                          {item.subcategory && <span> → {catLabel(item.subcategory, allSubcats)}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={{ background: "var(--blue-light)", color: "var(--blue)" }}>
                      {catLabel(item.category, allCats)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold" style={{ color: "var(--blue)" }}>
                    {priceDisplay(Number(item.price))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge" style={item.is_available
                      ? { background: "#e8f5e9", color: "#2e7d32" }
                      : { background: "#fce4ec", color: "#b71c1c" }}>
                      {item.is_available ? t.available : t.unavailable}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs px-3 py-1 rounded-lg border font-medium hover:bg-gray-50"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{t.edit}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
