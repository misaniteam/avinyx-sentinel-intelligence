"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/lib/auth/auth-provider";

interface TenantContextType {
  tenantId: string | null;
  isSuperAdmin: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  isSuperAdmin: false,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenant_id || null,
        isSuperAdmin: user?.is_super_admin || false,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
