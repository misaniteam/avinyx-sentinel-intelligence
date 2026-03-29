"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  ChevronRightIcon,
  ChevronLeftIcon,
  LogOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "../ui/button";
import { useUIStore } from "@/store/uiStore";
import { ProgressiveBlur } from "../ui/progressive-blur";

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
  {
    titleKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view",
  },
  {
    titleKey: "voters",
    href: "/voters",
    icon: Users,
    permission: "voters:read",
  },
  {
    titleKey: "voterUpload",
    href: "/voter-upload",
    icon: FileUp,
    permission: "voters:write",
  },
  {
    titleKey: "heatmap",
    href: "/heatmap",
    icon: Map,
    permission: "heatmap:view",
  },
  {
    titleKey: "mediaFeeds",
    href: "/media-feeds",
    icon: Rss,
    permission: "media:read",
  },
  {
    titleKey: "analytics",
    href: "/analytics",
    icon: BarChart3,
    permission: "analytics:read",
  },
  {
    titleKey: "reports",
    href: "/reports",
    icon: FileText,
    permission: "reports:read",
  },
  {
    titleKey: "campaigns",
    href: "/campaigns",
    icon: Megaphone,
    permission: "campaigns:read",
  },
];

const adminNavItems: NavItem[] = [
  {
    titleKey: "dataSources",
    href: "/admin/data-sources",
    icon: Database,
    permission: "data_sources:read",
  },
  {
    titleKey: "ingestedData",
    href: "/admin/ingested-data",
    icon: FileSearch,
    permission: "data_sources:read",
  },
  {
    titleKey: "topics",
    href: "/admin/topics",
    icon: Tags,
    permission: "topics:read",
  },
  {
    titleKey: "users",
    href: "/admin/users",
    icon: Users,
    permission: "users:read",
  },
  {
    titleKey: "roles",
    href: "/admin/roles",
    icon: ShieldCheck,
    permission: "roles:read",
  },
  {
    titleKey: "workers",
    href: "/admin/workers",
    icon: Activity,
    permission: "workers:read",
  },
  {
    titleKey: "settings",
    href: "/admin/settings",
    icon: Settings,
    permission: "settings:read",
  },
];

const superAdminNavItems: NavItem[] = [
  { titleKey: "tenants", href: "/super-admin/tenants", icon: Shield },
  {
    titleKey: "infrastructure",
    href: "/super-admin/infrastructure",
    icon: Server,
  },
];

function NavLink({
  item,
  pathname,
  t,
  isOpen,
}: {
  item: NavItem;
  pathname: string;
  t: (key: string) => string;
  isOpen: boolean;
}) {
  const isActive = pathname.startsWith(item.href);
  return (
    <>
      <span
        className={`absolute left-0 top-2 h-8 w-1 rounded-r-full transition-opacity
                          ${
                            isActive
                              ? "bg-theme-primary opacity-100"
                              : "bg-theme-primary opacity-0 group-hover:opacity-100"
                          }`}
      ></span>
      <Link
        href={item.href || "#"}
        className={`flex items-center justify-between py-3 px-4 space-x-3 relative rounded-[8px] transition-all duration-200                        
                          ${
                            isActive
                              ? `text-primary bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
                                shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`
                              : `text-muted hover:bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
                                hover:shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`
                          }`}
      >
        <span className="flex items-center gap-2 flex-1 min-h-6">
          <item.icon className={isActive ? "text-primary" : "text-muted"} />
          {!isOpen && (
            <span className="whitespace-nowrap capitalize">
              {t(item.titleKey)}
            </span>
          )}
        </span>
      </Link>
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermission();
  const { isSuperAdmin } = useTenant();
  const t = useTranslations("navigation");
  const { resolvedTheme } = useTheme();
  const [showTopBlur, setShowTopBlur] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showBottomBlur, setShowBottomBlur] = useState(false);
  const { isOpen, toggleSidebar } = useUIStore();
  const { user, logout } = useAuth();
  const isDark = resolvedTheme === "dark";

  function filterByPermission(items: NavItem[]) {
    return items.filter((item) => {
      if (item.permission) return hasPermission(item.permission);
      return true;
    });
  }
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;

    const newTop = scrollTop > 0;
    const newBottom = scrollTop + clientHeight < scrollHeight - 1;

    setShowTopBlur((prev) => (prev !== newTop ? newTop : prev));
    setShowBottomBlur((prev) => (prev !== newBottom ? newBottom : prev));
  };

  useEffect(() => {
    handleScroll();
  }, []);

  if (isSuperAdmin) {
    return (
      <div
        className={`${isOpen ? "w-[100px]" : "w-[280px]"}      
       border-r border-input min-h-screen duration-300 ease-in-out bg-card fixed xl:relative z-sidebar`}
      >
        <div className="relative">
          <span
            className="absolute z-normal top-1/2 -translate-y-1/2 -right-4 cursor-pointer duration-300 ease-in-out items-center justify-center
         lg:flex hidden bg-body-bg rounded-full border-input border h-8 w-8"
            onClick={toggleSidebar}
          >
            {isOpen ? (
              <ChevronRightIcon className="text-theme-primary" />
            ) : (
              <ChevronLeftIcon className="text-theme-primary" />
            )}
          </span>
          {/* Logo */}
          <div className="h-[80px] flex items-center justify-center px-6">
            <div
              key={`${isDark}`} // Change key when theme changes
              className="mx-auto py-5"
            >
              <Link href={"/dashboard"}>
                <Image
                  src={
                    !isOpen
                      ? isDark
                        ? "/logo/logo-white.svg"
                        : "/logo/logo-black.svg"
                      : "/logo/small-logo.png"
                  }
                  width={!isOpen ? 120 : 33}
                  height={!isOpen ? 50 : 47}
                  alt="Avinyx AI"
                  className="mx-auto"
                />
              </Link>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 relative">
          <ul>
            {superAdminNavItems.map((item, index) => (
              <li key={index} className="px-6 relative group">
                <NavLink
                  isOpen={isOpen}
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  t={t}
                />
              </li>
            ))}
          </ul>
        </nav>
        <div className="absolute w-full left-0 bottom-0 ">
          <hr className="border-input block px-6 w-full mt-0" />
          {/* User section */}
          <div
            onClick={logout}
            className="flex items-center gap-3 h-11 w-full px-8 relative group flex-1 cursor-pointer py-10"
          >
            <Button variant="ghost" size="icon">
              <LogOut className="h-5 w-5" />
            </Button>
            <span className="text-muted">Log out</span>
          </div>
        </div>
      </div>
    );
  }

  const visibleMain = filterByPermission(mainNavItems);
  const visibleAdmin = filterByPermission(adminNavItems);

  return (
    <div
      className={`${isOpen ? "w-[100px]" : "w-[280px]"}      
       border-r border-input min-h-screen duration-300 ease-in-out bg-card fixed xl:relative z-sidebar`}
    >
      <div className="relative">
        <span
          className="absolute z-normal top-1/2 -translate-y-1/2 -right-4 cursor-pointer duration-300 ease-in-out items-center justify-center
         lg:flex hidden bg-body-bg rounded-full border-input border h-8 w-8"
          onClick={toggleSidebar}
        >
          {isOpen ? (
            <ChevronRightIcon className="text-theme-primary" />
          ) : (
            <ChevronLeftIcon className="text-theme-primary" />
          )}
        </span>
        {/* Logo */}
        <div className="h-[80px] flex items-center justify-center px-6">
          <div
            key={`${isDark}`} // Change key when theme changes
            className="mx-auto py-5"
          >
            <Link href={"/dashboard"}>
              <Image
                src={
                  !isOpen
                    ? isDark
                      ? "/logo/logo-white.svg"
                      : "/logo/logo-black.svg"
                    : "/logo/small-logo.png"
                }
                width={!isOpen ? 120 : 33}
                height={!isOpen ? 50 : 47}
                alt="Avinyx AI"
                className="mx-auto"
              />
            </Link>
          </div>
        </div>
      </div>
      {/* Sidebar nav */}

      <div className="h-[calc(100vh-175px)] relative">
        {showTopBlur && (
          <ProgressiveBlur
            position="top"
            height="10%"
            className="absolute top-0 left-0 w-full pointer-events-none"
          />
        )}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-visible h-full sideBar"
        >
          <nav>
            <ul className="space-y-1">
              {visibleMain.map((item, index) => (
                <li key={index} className="px-6 relative group">
                  <NavLink
                    isOpen={isOpen}
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    t={t}
                  />
                </li>
              ))}
            </ul>
            <ul className="space-y-1">
              {visibleAdmin.length > 0 && (
                <>
                  <div className="my-4 border-t" />
                  {!isOpen && (
                    <p className="mb-2 px-10 font-semibold capitalize tracking-wider text-sidebar-foreground/50">
                      {t("admin")}
                    </p>
                  )}

                  {visibleAdmin.map((item, index) => (
                    <li key={index} className="px-6 relative group">
                      <NavLink
                        isOpen={isOpen}
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        t={t}
                      />
                    </li>
                  ))}
                </>
              )}
            </ul>
          </nav>
        </div>
        {showBottomBlur && (
          <ProgressiveBlur
            position="bottom"
            height="10%"
            className="absolute bottom-0 left-0 w-full pointer-events-none -mb-1"
          />
        )}
      </div>
      <div className="absolute w-full left-0 bottom-0 ">
        <hr className="border-input block px-6 w-full mt-0" />
        {/* User section */}
        <div
          onClick={logout}
          className="flex items-center gap-3 h-11 w-full px-8 relative group flex-1 cursor-pointer py-10"
        >
          <Button variant="ghost" size="icon">
            <LogOut className="h-5 w-5" />
          </Button>
          {!isOpen && (
            <span className="text-muted">
              {user?.is_super_admin
                ? t("superAdmin")
                : user?.roles?.[0] || t("user")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
