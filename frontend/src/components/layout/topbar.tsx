"use client";

import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { LogOut, Bell } from "lucide-react";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <div className="text-sm text-muted-foreground">
          {user?.is_super_admin ? "Super Admin" : user?.roles?.[0] || "User"}
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
