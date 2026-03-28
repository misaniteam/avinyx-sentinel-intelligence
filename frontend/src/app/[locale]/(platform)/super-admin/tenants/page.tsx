"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
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
  const t = useTranslations("superAdmin.tenants");
  const tc = useTranslations("common");
  const format = useFormatter();
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
      toast.success(newStatus === "active" ? t("tenantActivated") : t("tenantSuspended"));
    } catch {
      toast.error(t("failedUpdateStatus"));
    }
  };

  const handleDelete = async () => {
    if (!selectedTenant) return;
    try {
      await deleteTenant.mutateAsync(selectedTenant.id);
      toast.success(t("tenantDeleted"));
      setDeleteDialogOpen(false);
      setSelectedTenant(undefined);
    } catch {
      toast.error(t("failedDelete"));
    }
  };

  const openDeleteDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("onboardTenant")}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">{tc("name")}</th>
                <th className="p-3 text-left font-medium">{t("slug")}</th>
                <th className="p-3 text-left font-medium">{t("constituency")}</th>
                <th className="p-3 text-left font-medium">{tc("status")}</th>
                <th className="p-3 text-left font-medium">{t("created")}</th>
                <th className="p-3 text-right font-medium">{tc("actions")}</th>
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
                      {tenant.status === "active"
                        ? tc("active")
                        : tenant.status === "suspended"
                          ? tc("suspended")
                          : tc("inactive")}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {format.dateTime(new Date(tenant.created_at), { dateStyle: "medium" })}
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
                          <Pencil className="mr-1 h-4 w-4 text-theme-primary" /> {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(tenant)}>
                          {tenant.status === "active" ? (
                            <>
                              <Ban className="mr-1 h-4 w-4 text-theme-primary" /> {t("suspend")}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-1 h-4 w-4 text-theme-primary" /> {t("activate")}
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(tenant)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-1 h-4 w-4 text-theme-primary" /> {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {(!tenants || tenants.length === 0) && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    {t("noTenantsYet")}
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
        title={t("deleteTenant")}
        description={t("deleteConfirm", { name: selectedTenant?.name ?? "" })}
        onConfirm={handleDelete}
        isPending={deleteTenant.isPending}
      />
    </div>
  );
}
