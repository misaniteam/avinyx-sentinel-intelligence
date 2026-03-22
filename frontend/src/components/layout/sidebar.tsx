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
  Settings,
  Shield,
  Building2,
  Server,
} from "lucide-react";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const tenantNavItems: NavItem[] = [
  { titleKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view" },
  { titleKey: "voters", href: "/voters", icon: Users, permission: "voters:read" },
  { titleKey: "heatmap", href: "/heatmap", icon: Map, permission: "heatmap:view" },
  { titleKey: "mediaFeeds", href: "/media-feeds", icon: Rss, permission: "media:read" },
  { titleKey: "analytics", href: "/analytics", icon: BarChart3, permission: "analytics:read" },
  { titleKey: "reports", href: "/reports", icon: FileText, permission: "reports:read" },
  { titleKey: "campaigns", href: "/campaigns", icon: Megaphone, permission: "campaigns:read" },
  { titleKey: "dataSources", href: "/admin/data-sources", icon: Database, permission: "data_sources:read" },
  { titleKey: "ingestedData", href: "/admin/ingested-data", icon: FileSearch, permission: "data_sources:read" },
  { titleKey: "admin", href: "/admin/users", icon: Settings, permission: "users:read" },
];

const superAdminNavItems: NavItem[] = [
  { titleKey: "tenants", href: "/super-admin/tenants", icon: Shield },
  { titleKey: "infrastructure", href: "/super-admin/infrastructure", icon: Server },
];

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermission();
  const { isSuperAdmin } = useTenant();
  const t = useTranslations("navigation");

  const visibleItems = isSuperAdmin
    ? superAdminNavItems
    : tenantNavItems.filter((item) => {
        if (item.permission) return hasPermission(item.permission);
        return true;
      });

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <Building2 className="mr-2 h-6 w-6 text-sidebar-accent" />
        <span className="text-lg font-bold text-sidebar-foreground">{t("sentinel")}</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
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
        })}
      </nav>
    </aside>
  );
}
