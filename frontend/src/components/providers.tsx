"use client";
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { RBACProvider } from "@/lib/rbac/rbac-provider";
import { Toaster } from "sonner";

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
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
            <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
            <Toaster position="top-right" />
          </RBACProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
