"use client";

import { createContext, useContext, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-provider";

interface RBACContextType {
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
}

const RBACContext = createContext<RBACContextType>({
  permissions: [],
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
});

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const permissions = user?.permissions || [];

  const hasPermission = useCallback(
    (permission: string) => {
      if (permissions.includes("*")) return true;
      return permissions.includes(permission);
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]) => perms.some((p) => hasPermission(p)),
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (...perms: string[]) => perms.every((p) => hasPermission(p)),
    [hasPermission]
  );

  return (
    <RBACContext.Provider
      value={{ permissions, hasPermission, hasAnyPermission, hasAllPermissions }}
    >
      {children}
    </RBACContext.Provider>
  );
}

export function usePermission() {
  return useContext(RBACContext);
}
