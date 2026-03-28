"use client";

import { useState, useMemo } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useRoles, useDeleteRole } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { RoleDialog } from "@/components/admin/role-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import type { Role } from "@/types";

export default function AdminRolesPage() {
  const t = useTranslations("admin.roles");
  const tc = useTranslations("common");
  const format = useFormatter();

  const { data: roles, isLoading } = useRoles();
  const deleteRole = useDeleteRole();

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRole, setSelectedRole] = useState<Role | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | undefined>();

  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    if (!searchQuery.trim()) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter((role) => role.name.toLowerCase().includes(query));
  }, [roles, searchQuery]);

  function handleCreate() {
    setDialogMode("create");
    setSelectedRole(undefined);
    setDialogOpen(true);
  }

  function handleEdit(role: Role) {
    setDialogMode("edit");
    setSelectedRole(role);
    setDialogOpen(true);
  }

  function handleDeleteClick(role: Role) {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!roleToDelete) return;
    try {
      await deleteRole.mutateAsync(roleToDelete.id);
      toast.success(t("roleDeleted"));
      setDeleteDialogOpen(false);
      setRoleToDelete(undefined);
    } catch {
      toast.error(t("failedDelete"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {t("title")}{roles ? ` (${roles.length})` : ""}
        </h1>
        <PermissionGate permission="roles:write">
          <Button onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("createRole")}
          </Button>
        </PermissionGate>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="rounded-md border">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 ml-auto" />
            </div>
          ))}
        </div>
      ) : filteredRoles.length === 0 && !searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">{t("noRolesYet")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("noRolesYetDescription")}
          </p>
          <PermissionGate permission="roles:write">
            <Button onClick={handleCreate}>
              <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("createRole")}
            </Button>
          </PermissionGate>
        </div>
      ) : filteredRoles.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">{t("noRolesFound")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("noRolesFoundDescription", { query: searchQuery })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{tc("name")}</th>
                <th className="px-4 py-3 text-left font-medium">{tc("description")}</th>
                <th className="px-4 py-3 text-left font-medium">{tc("permissions")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("created")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{tc("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr key={role.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {role.description || tc("noDescription")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {role.permissions.length} {role.permissions.length !== 1 ? tc("permissions") : tc("permission")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format.dateTime(new Date(role.created_at), { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PermissionGate permission="roles:write">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(role)}>
                            <Pencil className="mr-1 h-4 w-4 text-theme-primary" />
                            {tc("edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(role)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-1 h-4 w-4 text-theme-primary" />
                            {tc("delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RoleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        role={selectedRole}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteRole")}
        description={t("deleteRoleConfirm", { name: roleToDelete?.name ?? "" })}
        onConfirm={handleDeleteConfirm}
        isPending={deleteRole.isPending}
      />
    </div>
  );
}
