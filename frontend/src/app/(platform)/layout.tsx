import { AuthGuard } from "@/lib/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
