export const PERMISSION_GROUPS = [
  { resource: "dashboard", actions: ["view", "edit"] },
  { resource: "voters", actions: ["read", "write"] },
  { resource: "campaigns", actions: ["read", "write"] },
  { resource: "media", actions: ["read", "write"] },
  { resource: "analytics", actions: ["read", "export"] },
  { resource: "reports", actions: ["read", "write", "export"] },
  { resource: "heatmap", actions: ["view"] },
  { resource: "users", actions: ["read", "write"] },
  { resource: "roles", actions: ["read", "write"] },
  { resource: "settings", actions: ["read", "write"] },
  { resource: "workers", actions: ["read", "manage"] },
  { resource: "data_sources", actions: ["read", "write"] },
] as const;

export function formatPermission(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export function getAllPermissions(): string[] {
  return PERMISSION_GROUPS.flatMap((g) =>
    g.actions.map((a) => formatPermission(g.resource, a))
  );
}
