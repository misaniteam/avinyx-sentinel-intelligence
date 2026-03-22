"use client";

import { useAuth } from "@/lib/auth/auth-provider";
import { useNotifications, useNotificationCount } from "@/lib/firebase/hooks";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { LogOut, Bell } from "lucide-react";
import { ModeToggle } from "../shared/mode-toggle";

export function Topbar() {
  const { user, logout } = useAuth();
  const { notifications, isLoading: notificationsLoading } = useNotifications();
  const unreadCount = useNotificationCount(notifications);
  const t = useTranslations("common");

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        
        <ModeToggle />
        <LocaleSwitcher />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-0 w-80">
            <NotificationPanel notifications={notifications} isLoading={notificationsLoading} />
          </PopoverContent>
        </Popover>
        <div className="text-sm text-muted-foreground">
          {user?.is_super_admin ? t("superAdmin") : user?.roles?.[0] || t("user")}
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
