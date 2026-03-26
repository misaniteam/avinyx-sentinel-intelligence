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
  ChevronRightIcon,
  ChevronLeftIcon,
  LogOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ProgressiveBlur } from "../ui/progressive-blur";
import { useUIStore } from "@/store/uiStore";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "../ui/button";

interface NavItem {
  titleKey: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const tenantNavItems: NavItem[] = [
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
    titleKey: "Voter Upload",
    href: "/voter-upload",
    icon: FileUp,
    permission: "voters:write",
  },
  { titleKey: "roles", href: "/roles", icon: User, permission: "roles" },
  {
    titleKey: "heatmap",
    href: "/heatmap",
    icon: Map,
    permission: "heatmap:view",
  },
  {
    titleKey: "Media Feeds",
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
  {
    titleKey: "Data Sources",
    href: "/admin/data-sources",
    icon: Database,
    permission: "data_sources:read",
  },
  {
    titleKey: "Ingested Data",
    href: "/admin/ingested-data",
    icon: FileSearch,
    permission: "data_sources:read",
  },
  {
    titleKey: "admin",
    href: "/admin/users",
    icon: Settings,
    permission: "users:read",
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

export function Sidebar() {
  const pathname = usePathname();
  const { hasPermission } = usePermission();
  const { isSuperAdmin } = useTenant();
  const t = useTranslations("navigation");
  const { theme, setTheme } = useTheme();
  const [showTopBlur, setShowTopBlur] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showBottomBlur, setShowBottomBlur] = useState(false);
  const { isOpen, toggleSidebar } = useUIStore();
  const { user, logout } = useAuth();

  const visibleItems = isSuperAdmin
    ? superAdminNavItems
    : tenantNavItems.filter((item) => {
        if (item.permission) return hasPermission(item.permission);
        return true;
      });
  const isDark = theme === "dark";

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
        <div className="h-[90px] flex items-center justify-center px-6">
          <div
            key={`${isDark}`} // Change key when theme changes
            className="mx-auto py-5"
          >
            <Link href={"/"}>
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
      <div className="h-[calc(100vh-200px)] relative mb-1">
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
              {visibleItems.map((item, index) => {
                const isActive = pathname.startsWith(item.href);
                const isDisabled = !item.href;

                return (
                  <li key={index} className="px-6 relative group">
                    {!isDisabled && (
                      <span
                        className={`absolute left-0 top-2 h-8 w-1 rounded-r-full transition-opacity
                          ${
                            isActive
                              ? "bg-theme-primary opacity-100"
                              : "bg-theme-primary opacity-0 group-hover:opacity-100"
                          }`}
                      ></span>
                    )}

                    <Link
                      href={item.href || "#"}
                      onClick={(e) => {
                        if (isDisabled) {
                          e.preventDefault();
                          return;
                        }
                      }}
                      className={`flex items-center justify-between py-3 px-4 space-x-3 relative rounded-[8px] transition-all duration-200                        
                          ${
                            isDisabled
                              ? "text-muted/50 cursor-not-allowed"
                              : isActive
                                ? `text-primary bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
                                shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`
                                : `text-muted hover:bg-[linear-gradient(to_right,var(--theme-primary-dark-2),var(--theme-primary-dark-2),var(--card))]
                                hover:shadow-[-4px_0_0px_-2px_var(--theme-primary-dark-1),_-2px_0_4px_-2px_var(--theme-primary-dark-1)]`
                          }`}
                    >
                      <span className="flex items-center gap-2 flex-1 min-h-6">
                        <item.icon
                          className={
                            isDisabled
                              ? "text-muted/50"
                              : isActive
                                ? "text-primary"
                                : "text-muted"
                          }
                        />
                        {!isOpen && (
                          <span className="whitespace-nowrap capitalize">
                            {item.titleKey}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
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
        <hr className="border-input block px-6 w-full" />
        {/* User section */}
        <div className="flex items-center gap-3 h-11 w-full px-8 relative group flex-1 cursor-pointer py-10">
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
          <div className="text-muted">Log out</div>
        </div>
      </div>
    </div>
  );
}
