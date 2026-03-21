"use client";

import { useState, useMemo } from "react";
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminRolesPage() {
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
      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setRoleToDelete(undefined);
    } catch {
      toast.error("Failed to delete role");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Roles{roles ? ` (${roles.length})` : ""}
        </h1>
        <PermissionGate permission="roles:write">
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Create Role
          </Button>
        </PermissionGate>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          aria-label="Search roles"
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
          <h3 className="text-lg font-semibold">No roles yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first role to manage team permissions.
          </p>
          <PermissionGate permission="roles:write">
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> Create Role
            </Button>
          </PermissionGate>
        </div>
      ) : filteredRoles.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No roles found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No roles match &quot;{searchQuery}&quot;. Try a different search term.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Permissions</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.map((role) => (
                <tr key={role.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {role.description || "No description"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(role.created_at)}
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
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(role)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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
        title="Delete Role"
        description={`Are you sure you want to delete the "${roleToDelete?.name}" role? Users assigned this role will lose its permissions.`}
        onConfirm={handleDeleteConfirm}
        isPending={deleteRole.isPending}
      />
    </div>
  );
}
