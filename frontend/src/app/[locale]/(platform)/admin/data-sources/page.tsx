"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDataSources, useDeleteDataSource } from "@/lib/api/hooks";
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
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Database,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { DataSourceDialog } from "@/components/admin/data-source-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import { platformConfig } from "@/lib/constants/platforms";
import type { DataSource } from "@/types";

export default function AdminDataSourcesPage() {
  const t = useTranslations("admin.dataSources");
  const tc = useTranslations("common");

  const { data: dataSources, isLoading } = useDataSources();
  const deleteDataSource = useDeleteDataSource();

  function formatDate(dateString: string | null): string {
    if (!dateString) return tc("never");
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dsToDelete, setDsToDelete] = useState<DataSource | undefined>();

  const filteredDataSources = useMemo(() => {
    if (!dataSources) return [];
    if (!searchQuery.trim()) return dataSources;
    const query = searchQuery.toLowerCase();
    return dataSources.filter((ds) => ds.name.toLowerCase().includes(query));
  }, [dataSources, searchQuery]);

  function handleCreate() {
    setDialogMode("create");
    setSelectedDataSource(undefined);
    setDialogOpen(true);
  }

  function handleEdit(ds: DataSource) {
    setDialogMode("edit");
    setSelectedDataSource(ds);
    setDialogOpen(true);
  }

  function handleDeleteClick(ds: DataSource) {
    setDsToDelete(ds);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!dsToDelete) return;
    try {
      await deleteDataSource.mutateAsync(dsToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setDsToDelete(undefined);
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {t("title")}{dataSources ? ` (${dataSources.length})` : ""}
        </h1>
        <PermissionGate permission="data_sources:write">
          <Button onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("addDataSource")}
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
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 ml-auto" />
            </div>
          ))}
        </div>
      ) : filteredDataSources.length === 0 && !searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Database className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">{t("noDataSourcesYet")}</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("noDataSourcesYetDescription")}
          </p>
          <PermissionGate permission="data_sources:write">
            <Button onClick={handleCreate}>
              <Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("addDataSource")}
            </Button>
          </PermissionGate>
        </div>
      ) : filteredDataSources.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">{t("noDataSourcesFound")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("noDataSourcesFoundDescription", { query: searchQuery })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{tc("name")}</th>
                <th className="px-4 py-3 text-left font-medium">{tc("platform")}</th>
                <th className="px-4 py-3 text-left font-medium">{tc("status")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("pollInterval")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("lastPolled")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">{tc("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDataSources.map((ds) => {
                const platform = platformConfig[ds.platform] || {
                  label: ds.platform,
                  icon: Globe,
                  color: "bg-gray-100 text-gray-800",
                };
                const PlatformIcon = platform.icon;

                return (
                  <tr key={ds.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{ds.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={platform.color}>
                        <PlatformIcon className="mr-1 h-3 w-3" />
                        {platform.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ds.is_active ? "default" : "outline"}>
                        {ds.is_active ? tc("active") : tc("inactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ds.poll_interval_minutes} {tc("min")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(ds.last_polled_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PermissionGate permission="data_sources:write">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(ds)}>
                              <Pencil className="mr-1 h-4 w-4 text-theme-primary" />
                              {tc("edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(ds)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DataSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        dataSource={selectedDataSource}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: dsToDelete?.name ?? "" })}
        onConfirm={handleDeleteConfirm}
        isPending={deleteDataSource.isPending}
      />
    </div>
  );
}
