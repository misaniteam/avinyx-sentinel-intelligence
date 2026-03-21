"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { WB_CONSTITUENCY_MAP, type Constituency } from "@/lib/data/wb-constituencies";

interface TenantContextType {
  tenantId: string | null;
  isSuperAdmin: boolean;
  constituencyCode: string | null;
  constituency: Constituency | null;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null,
  isSuperAdmin: false,
  constituencyCode: null,
  constituency: null,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const constituencyCode = user?.constituency_code || null;
  const constituency = constituencyCode
    ? WB_CONSTITUENCY_MAP.get(constituencyCode) ?? null
    : null;

  return (
    <TenantContext.Provider
      value={{
        tenantId: user?.tenant_id || null,
        isSuperAdmin: user?.is_super_admin || false,
        constituencyCode,
        constituency,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
