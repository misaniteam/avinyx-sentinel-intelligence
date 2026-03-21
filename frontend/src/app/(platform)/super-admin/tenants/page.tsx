"use client";

import { useState } from "react";
import { useTenants, useUpdateTenant, useDeleteTenant } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Pencil, Ban, CheckCircle, Trash2 } from "lucide-react";
import { TenantDialog } from "@/components/admin/tenant-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { WB_CONSTITUENCY_MAP } from "@/lib/data/wb-constituencies";
import { toast } from "sonner";
import type { Tenant } from "@/types";

export default function SuperAdminTenantsPage() {
  const { data: tenants, isLoading } = useTenants();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleCreate = () => {
    setDialogMode("create");
    setSelectedTenant(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setDialogMode("edit");
    setSelectedTenant(tenant);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === "active" ? "suspended" : "active";
    try {
      await updateTenant.mutateAsync({ id: tenant.id, status: newStatus });
      toast.success(`Tenant ${newStatus === "active" ? "activated" : "suspended"}`);
    } catch {
      toast.error("Failed to update tenant status");
    }
  };

  const handleDelete = async () => {
    if (!selectedTenant) return;
    try {
      await deleteTenant.mutateAsync(selectedTenant.id);
      toast.success("Tenant deleted");
      setDeleteDialogOpen(false);
      setSelectedTenant(undefined);
    } catch {
      toast.error("Failed to delete tenant");
    }
  };

  const openDeleteDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> Onboard Tenant
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Slug</th>
                <th className="p-3 text-left font-medium">Constituency</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Created</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants?.map((tenant) => (
                <tr key={tenant.id} className="border-b">
                  <td className="p-3 font-medium">{tenant.name}</td>
                  <td className="p-3">{tenant.slug}</td>
                  <td className="p-3 text-muted-foreground">
                    {tenant.constituency_code
                      ? WB_CONSTITUENCY_MAP.get(tenant.constituency_code)?.name ?? tenant.constituency_code
                      : "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        tenant.status === "active"
                          ? "bg-green-100 text-green-800"
                          : tenant.status === "suspended"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(tenant)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(tenant)}>
                          {tenant.status === "active" ? (
                            <>
                              <Ban className="mr-2 h-4 w-4" /> Suspend
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(tenant)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {(!tenants || tenants.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No tenants yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <TenantDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        tenant={selectedTenant}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Tenant"
        description={`Are you sure you want to delete "${selectedTenant?.name}"? This action cannot be undone and will remove all tenant data.`}
        onConfirm={handleDelete}
        isPending={deleteTenant.isPending}
      />
    </div>
  );
}
