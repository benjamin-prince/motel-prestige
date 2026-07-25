"use client";
import { useI18n } from "@/lib/i18n";
import { useProperty, SiteCapabilities } from "@/lib/property-context";
import { usePermissions } from "@/lib/permissions";

export type Capability = keyof SiteCapabilities;
export type NavItem = { label: string; href: string; cap?: Capability; perm?: string | string[] };
export type NavSection = {
  key: string;
  label: string;
  icon: string;
  children: NavItem[];
  defaultOpen?: boolean;
  cap?: Capability;
};

// Permission key(s) required to access each route — keyed by base path
// (longest prefix wins). Keep in sync with the backend permissions catalog
// seeded in backend/app/seeders.py.
export const ROUTE_PERMS: Record<string, string | string[]> = {
  "/":                                "fo.dashboard",
  "/admin/settings":                  "admin.settings",
  "/admin/users":                     "admin.users.view",
  "/admin/roles":                     "admin.roles",
  "/admin/audit-log":                 "admin.audit_log",
  "/front-office/configuration":      "fo.configuration",
  "/front-office/room-status":        "fo.rooms.status",
  "/front-office/unsettled":          "fo.unsettled",
  "/front-office/nightly-charges":    "fo.nightly_charges",
  "/front-office/reference":          "fo.reference",
  "/front-office/service":            "fo.configuration",
  "/front-office/outlet":             ["fnb.outlets", "fnb.orders.view"],
  "/front-office/store-requisition":  ["fo.store_req", "fo.store_req.approve"],
  "/front-office/stock-status":       "fo.stock",
  "/front-office/report":             "fo.report",
  "/rooms":                           "fo.rooms.view",
  "/reservations":                    "fo.res.view",
  "/night-audit":                     "fo.night_audit",
  "/guests":                          "guests.view",
  "/keycards":                        "kc.view",
  "/housekeeping/assignment":         "hk.assignment",
  "/housekeeping/tasks":              "hk.tasks.view",
  "/housekeeping/lost-found":         "hk.lost_found",
  "/maintenance/requests":            "maint.view",
  "/maintenance/schedule":            "maint.view",
  "/fnb/menu":                        "fnb.menu.view",
  "/fnb/orders":                      "fnb.orders.view",
  "/fnb/outlets":                     "fnb.outlets",
  "/sales/packages":                  "sales.packages.view",
  "/sales/agents":                    "sales.agents.view",
  "/sales/reports":                   "sales.reports",
  "/revenue":                         "revenue.view",
  "/hrm/staff":                       "hrm.staff.view",
  "/hrm/schedules":                   "hrm.schedules",
  "/hrm/payroll":                     "hrm.payroll",
  "/billing":                         "acc.invoices.view",
  "/accounts/caisse":                 "acc.caisse",
  "/accounts/currencies":             "acc.currencies",
  "/accounts/payments":               "acc.payments.view",
  "/accounts/ledger":                 "acc.ledger",
};

/** Permission required for a pathname — longest matching base path wins. */
export function routePermission(pathname: string): string | string[] | undefined {
  if (pathname === "/") return ROUTE_PERMS["/"];
  let best: string | undefined;
  for (const base of Object.keys(ROUTE_PERMS)) {
    if (base !== "/" && pathname.startsWith(base) && (!best || base.length > best.length)) {
      best = base;
    }
  }
  return best ? ROUTE_PERMS[best] : undefined;
}

// Single source of truth for app navigation — used by the Sidebar and the
// command palette. Filtered by the current site's capabilities and the
// signed-in user's role permissions.
export function useNavSections(): NavSection[] {
  const { t } = useI18n();
  const { capabilities } = useProperty();
  const { ready, can } = usePermissions();

  const allNav: NavSection[] = [
    {
      key: "admin", label: t.nav_app_admin, icon: "⚙️",
      children: [
        { label: t.nav_settings, href: "/admin/settings" },
        { label: t.nav_users,    href: "/admin/users" },
        { label: t.nav_roles,    href: "/admin/roles" },
        { label: t.nav_audit_log,href: "/admin/audit-log" },
      ],
    },
    {
      key: "fo", label: t.nav_front_office, icon: "🖥️", defaultOpen: true,
      children: [
        { label: t.nav_dashboard,       href: "/" },
        { label: t.nav_configuration,   href: "/front-office/configuration" },
        { label: t.nav_manage_rooms,    href: "/rooms",                          cap: "lodging" },
        { label: t.nav_room_status,     href: "/front-office/room-status",       cap: "lodging" },
        { label: t.nav_reservation,     href: "/reservations",                   cap: "lodging" },
        { label: t.nav_checkin_list,    href: "/reservations?status=confirmed",  cap: "lodging", perm: "fo.checkin" },
        { label: t.nav_checkout_list,   href: "/reservations?status=checked_in", cap: "lodging", perm: "fo.checkout" },
        { label: t.nav_unsettled,       href: "/front-office/unsettled",         cap: "lodging" },
        { label: t.nav_nightly_charges, href: "/front-office/nightly-charges",   cap: "lodging" },
        { label: t.nav_night_audit,     href: "/night-audit",                    cap: "lodging" },
        { label: t.nav_guests,          href: "/guests" },
        { label: t.nav_reference,       href: "/front-office/reference" },
        { label: t.nav_service,         href: "/front-office/service" },
        { label: t.nav_outlet,          href: "/front-office/outlet",            cap: "fnb" },
        { label: t.nav_store_req,       href: "/front-office/store-requisition" },
        { label: t.nav_stock_status,    href: "/front-office/stock-status" },
        { label: t.nav_report,          href: "/front-office/report" },
      ],
    },
    {
      key: "hk", label: t.nav_housekeeping, icon: "🧹", cap: "lodging",
      children: [
        { label: t.nav_room_assignment, href: "/housekeeping/assignment" },
        { label: t.nav_task_list,       href: "/housekeeping/tasks" },
        { label: t.nav_lost_found,      href: "/housekeeping/lost-found" },
      ],
    },
    {
      key: "maint", label: t.nav_maintenance, icon: "🔧",
      children: [
        { label: t.nav_work_orders,     href: "/maintenance/requests" },
        { label: t.nav_maint_schedule,  href: "/maintenance/schedule" },
      ],
    },
    {
      key: "kc", label: t.nav_key_cards, icon: "🔑", cap: "lodging",
      children: [
        { label: t.nav_card_management, href: "/keycards" },
      ],
    },
    {
      key: "fnb", label: t.nav_fnb, icon: "🍽️", cap: "fnb",
      children: [
        { label: t.nav_menu,    href: "/fnb/menu" },
        { label: t.nav_orders,  href: "/fnb/orders" },
        { label: t.nav_outlets, href: "/fnb/outlets" },
      ],
    },
    {
      key: "sales", label: t.nav_sales, icon: "📊",
      children: [
        { label: t.nav_revenue,       href: "/revenue" },
        { label: t.nav_packages,      href: "/sales/packages" },
        { label: t.nav_agents,        href: "/sales/agents" },
        { label: t.nav_sales_reports, href: "/sales/reports" },
      ],
    },
    {
      key: "hrm", label: t.nav_hrm, icon: "👥",
      children: [
        { label: t.nav_staff,     href: "/hrm/staff" },
        { label: t.nav_schedules, href: "/hrm/schedules" },
        { label: t.nav_payroll,   href: "/hrm/payroll" },
      ],
    },
    {
      key: "accounts", label: t.nav_accounts, icon: "💳",
      children: [
        { label: t.nav_invoices,   href: "/billing" },
        { label: t.nav_caisse,     href: "/accounts/caisse" },
        { label: t.nav_currencies, href: "/accounts/currencies" },
        { label: t.nav_payments,   href: "/accounts/payments" },
        { label: t.nav_ledger,     href: "/accounts/ledger" },
      ],
    },
  ];

  // Wait for the user's permissions before showing any navigation, so
  // restricted entries never flash for unauthorized users.
  if (!ready) return [];

  const itemAllowed = (c: NavItem) => {
    const perm = c.perm ?? routePermission(c.href.split("?")[0]);
    return can(perm);
  };

  // Only show what this site offers (set up in Settings → Sites) AND what
  // the user's role permits (set up in Settings → Roles & Permissions).
  return allNav
    .filter(s => !s.cap || capabilities[s.cap])
    .map(s => ({
      ...s,
      children: s.children.filter(c => (!c.cap || capabilities[c.cap]) && itemAllowed(c)),
    }))
    .filter(s => s.children.length > 0);
}

export const isNavActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
