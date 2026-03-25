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
  User,
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
  { titleKey: "voterUpload", href: "/voter-upload", icon: FileUp, permission: "voters:write" },
  { titleKey: "roles", href: "/roles", icon: User, permission: "roles" },
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
      <nav className="flex-1">
        <ul className="space-y-1">


          {visibleItems.map((item, index) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li
                key={index}
                className="px-6 relative group"
              >
                <span
                  className={`absolute left-0 top-2 h-8 w-1 rounded-r-full transition-opacity
      ${isActive
                      ? "bg-[var(--theme-primary)] opacity-100"
                      : "bg-[var(--theme-primary)] opacity-0 group-hover:opacity-100"
                    }`}
                ></span>
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between py-3 px-4 space-x-3 relative rounded-[8px] transition-all duration-200",
                    isActive
                      ? `text-primary bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
         shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`
                      : `text-muted hover:bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
         hover:shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`

                  )}
                >
                  {/* <span>
                  <item.icon className="h-4 w-4" />
                  {t(item.titleKey)}
                  </span> */}

                  <span className="flex items-center gap-2 flex-1 min-h-6">
                    <item.icon
                      className={
                        isActive
                          ? "text-primary"
                          : "text-muted"
                      }
                    />

                    <span className="whitespace-nowrap">{item.titleKey}</span>
                  </span>
                </Link>
              </li>

            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
