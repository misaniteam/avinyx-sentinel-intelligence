"use client";

import { usePermission } from "@/lib/rbac/rbac-provider";

interface PermissionGateProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const { hasPermission } = usePermission();
  if (!hasPermission(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
