"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { RBACProvider } from "@/lib/rbac/rbac-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <RBACProvider>
            {children}
            <Toaster position="top-right" />
          </RBACProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
