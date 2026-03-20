"use client";

import { useState } from "react";
import { useRoles, useDeleteRole } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RoleDialog } from "@/components/admin/role-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import type { Role } from "@/types";

export default function AdminRolesPage() {
  const { data: roles, isLoading } = useRoles();
  const deleteRole = useDeleteRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedRole, setSelectedRole] = useState<Role | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | undefined>();

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
        <h1 className="text-3xl font-bold">Roles</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create Role
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles?.map((role) => (
          <Card key={role.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <CardTitle className="text-lg">{role.name}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
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
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                {role.description || "No description"}
              </p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-muted px-2 py-1 text-xs"
                  >
                    {p}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="text-xs text-muted-foreground">
                    +{role.permissions.length - 5} more
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
