"use client";

import { useState, useMemo } from "react";
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
  Youtube,
  Twitter,
  Rss,
  Newspaper,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DataSourceDialog } from "@/components/admin/data-source-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { PermissionGate } from "@/components/shared/permission-gate";
import type { DataSource } from "@/types";

const platformConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  brand24: { label: "Brand24", icon: Globe, color: "bg-blue-100 text-blue-800" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-100 text-red-800" },
  twitter: { label: "Twitter", icon: Twitter, color: "bg-sky-100 text-sky-800" },
  news_rss: { label: "News RSS", icon: Rss, color: "bg-orange-100 text-orange-800" },
  news_api: { label: "News API", icon: Newspaper, color: "bg-purple-100 text-purple-800" },
  reddit: { label: "Reddit", icon: MessageCircle, color: "bg-amber-100 text-amber-800" },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDataSourcesPage() {
  const { data: dataSources, isLoading } = useDataSources();
  const deleteDataSource = useDeleteDataSource();

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
      toast.success("Data source deleted successfully");
      setDeleteDialogOpen(false);
      setDsToDelete(undefined);
    } catch {
      toast.error("Failed to delete data source");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Data Sources{dataSources ? ` (${dataSources.length})` : ""}
        </h1>
        <PermissionGate permission="data_sources:write">
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Add Data Source
          </Button>
        </PermissionGate>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search data sources..."
          aria-label="Search data sources"
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
          <h3 className="text-lg font-semibold">No data sources yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Add your first platform connector to start ingesting data.
          </p>
          <PermissionGate permission="data_sources:write">
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Data Source
            </Button>
          </PermissionGate>
        </div>
      ) : filteredDataSources.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">No data sources found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No data sources match &quot;{searchQuery}&quot;. Try a different search term.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Platform</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Poll Interval</th>
                <th className="px-4 py-3 text-left font-medium">Last Polled</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
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
                        {ds.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ds.poll_interval_minutes} min
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
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(ds)}
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
        title="Delete Data Source"
        description={`Are you sure you want to delete the "${dsToDelete?.name}" data source? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        isPending={deleteDataSource.isPending}
      />
    </div>
  );
}
