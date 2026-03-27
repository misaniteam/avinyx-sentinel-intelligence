"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { usePermission } from "@/lib/rbac/rbac-provider";
import { useTenant } from "@/lib/tenant/tenant-provider";
import {
  LayoutDashboard,
  Users,
  Map,
  Rss,
  BarChart3,
  FileText,
  Megaphone,
  Database,
  FileSearch,
  FileUp,
  Settings,
  Shield,
  Building2,
  Server,
  Tags,
  ShieldCheck,
  Activity,
} from "lucide-react";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const mainNavItems: NavItem[] = [
  { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { titleKey: "voters", href: "/voters", icon: Users, permission: "voters:read" },
  { titleKey: "voterUpload", href: "/voter-upload", icon: FileUp, permission: "voters:write" },
  { titleKey: "heatmap", href: "/heatmap", icon: Map, permission: "heatmap:view" },
  { titleKey: "mediaFeeds", href: "/media-feeds", icon: Rss, permission: "media:read" },
  { titleKey: "analytics", href: "/analytics", icon: BarChart3, permission: "analytics:read" },
  { titleKey: "reports", href: "/reports", icon: FileText, permission: "reports:read" },
  { titleKey: "campaigns", href: "/campaigns", icon: Megaphone, permission: "campaigns:read" },
];

const adminNavItems: NavItem[] = [
  { titleKey: "dataSources", href: "/admin/data-sources", icon: Database, permission: "data_sources:read" },
  { titleKey: "ingestedData", href: "/admin/ingested-data", icon: FileSearch, permission: "data_sources:read" },
  { titleKey: "topics", href: "/admin/topics", icon: Tags, permission: "topics:read" },
  { titleKey: "users", href: "/admin/users", icon: Users, permission: "users:read" },
  { titleKey: "roles", href: "/admin/roles", icon: ShieldCheck, permission: "roles:read" },
  { titleKey: "workers", href: "/admin/workers", icon: Activity, permission: "workers:read" },
  { titleKey: "settings", href: "/admin/settings", icon: Settings, permission: "settings:read" },
];

const superAdminNavItems: NavItem[] = [
  { titleKey: "tenants", href: "/super-admin/tenants", icon: Shield },
  { titleKey: "infrastructure", href: "/super-admin/infrastructure", icon: Server },
];

function NavLink({ item, pathname, t }: { item: NavItem; pathname: string; t: (key: string) => string }) {
  const isActive = pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-white"
          : "text-sidebar-foreground hover:bg-sidebar-accent/10"
      )}
    >
      <item.icon className="h-4 w-4" />
      {t(item.titleKey)}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermission();
  const { isSuperAdmin } = useTenant();
  const t = useTranslations("navigation");

  function filterByPermission(items: NavItem[]) {
    return items.filter((item) => {
      if (item.permission) return hasPermission(item.permission);
      return true;
    });
  }

  if (isSuperAdmin) {
    return (
      <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
        <div className="flex h-16 items-center border-b px-6">
          <Building2 className="mr-2 h-6 w-6 text-sidebar-accent" />
          <span className="text-lg font-bold text-sidebar-foreground">{t("sentinel")}</span>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {superAdminNavItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} t={t} />
          ))}
        </nav>
      </aside>
    );
  }

  const visibleMain = filterByPermission(mainNavItems);
  const visibleAdmin = filterByPermission(adminNavItems);

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Building2 className="mr-2 h-6 w-6 text-sidebar-accent" />
        <span className="text-lg font-bold text-sidebar-foreground">{t("sentinel")}</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {visibleMain.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} t={t} />
          ))}
        </div>

        {visibleAdmin.length > 0 && (
          <>
            <div className="my-4 border-t" />
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {t("admin")}
            </p>
            <div className="space-y-1">
              {visibleAdmin.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} t={t} />
              ))}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
