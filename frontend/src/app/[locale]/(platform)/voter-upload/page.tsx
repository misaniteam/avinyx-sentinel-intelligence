"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  useVoterListGroups,
  useVoterListGroupDetail,
  useUploadVoterList,
  useDeleteVoterListGroup,
} from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Inbox,
  Loader2,
  X,
  Users,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/shared/permission-gate";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import {
  LocationSearch,
  type LocationResult,
} from "@/components/shared/location-search";
import MapProvider from "@/components/heatmap/map-provider";
import type { VoterListGroupItem } from "@/types";

const PAGE_SIZE = 50;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

function useFormatDate() {
  const format = useFormatter();
  return (dateString: string | null): string => {
    if (!dateString) return "—";
    return format.dateTime(new Date(dateString), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("voters");
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  const label =
    status === "completed"
      ? t("completed")
      : status === "failed"
        ? t("failed")
        : t("processing");
  return <Badge variant={variant}>{label}</Badge>;
}

// --- Upload Form ---
function UploadForm() {
  const t = useTranslations("voters");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [language, setLanguage] = useState("en");
  const [partNo, setPartNo] = useState("");
  const [partName, setPartName] = useState("");
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const uploadMutation = useUploadVoterList();

  const handleFileSelect = (file: File) => {
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Only PDF files are accepted");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File exceeds 50MB limit");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("year", year);
    formData.append("language", language);
    if (partNo.trim()) formData.append("part_no", partNo.trim());
    if (partName.trim()) formData.append("part_name", partName.trim());
    if (location) {
      formData.append("location_name", location.name);
      formData.append("location_lat", String(location.lat));
      formData.append("location_lng", String(location.lng));
    }

    try {
      await uploadMutation.mutateAsync(formData);
      toast.success(t("uploadSuccess"));
      setSelectedFile(null);
      setPartNo("");
      setPartName("");
      setLocation(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error(t("uploadError"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t("uploadPdf")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-sm text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {t("dragDropPdf")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("maxFileSize")}
              </p>
            </div>
          )}
        </div>

        {/* Year & Language */}
        <div className="flex items-end gap-4 justify-between">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("year")}</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("language")}</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("languageEn")}</SelectItem>
                <SelectItem value="bn">{t("languageBn")}</SelectItem>
                <SelectItem value="hi">{t("languageHi")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("partNo")}</label>
            <Input
              placeholder={t("partNo")}
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              maxLength={50}
              className="w-32"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("partName")}</label>
            <Input
              placeholder={t("partName")}
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              maxLength={255}
              className="w-48"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("location")}</label>
            <MapProvider fallthrough>
              <LocationSearch
                placeholder={t("searchLocation")}
                onChange={setLocation}
              />
            </MapProvider>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 text-theme-primary animate-spin" />
                {t("uploading")}
              </>
            ) : (
              <>
                <Upload className="mr-1 h-4 w-4 text-theme-primary" />
                {t("upload")}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Group Detail View ---
function GroupDetailView({
  groupId,
  onBack,
}: {
  groupId: string;
  onBack: () => void;
}) {
  const t = useTranslations("voters");
  const tc = useTranslations("common");
  const formatDate = useFormatDate();

  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useVoterListGroupDetail(groupId, {
    search: searchQuery || undefined,
    gender: genderFilter || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const group = data?.group;
  const entries = data?.entries ?? [];
  const totalEntries = data?.total_entries ?? 0;
  const from = totalEntries > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * PAGE_SIZE, totalEntries);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {t("backToList")}
        </Button>
      </div>

      {isLoading && !group ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : group ? (
        <>
          {/* Group info card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("constituency")}</p>
                  <p className="font-medium">{group.constituency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("partNo")}</p>
                  <p className="font-medium">{group.part_no || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("partName")}</p>
                  <p className="font-medium">{group.part_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("year")}</p>
                  <p className="font-medium">{group.year}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("status")}</p>
                  <StatusBadge status={group.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">{t("createdAt")}</p>
                  <p className="font-medium">{formatDate(group.created_at)}</p>
                </div>
                {group.location_name && (
                  <div>
                    <p className="text-muted-foreground">{t("location")}</p>
                    <p className="font-medium">{group.location_name}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchVoters")}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                className="pl-9 w-64"
              />
            </div>
            <Select
              value={genderFilter}
              onValueChange={(val) => {
                setGenderFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("allGenders")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">{t("male")}</SelectItem>
                <SelectItem value="Female">{t("female")}</SelectItem>
                <SelectItem value="Other">{t("other")}</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || genderFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setGenderFilter("");
                  setPage(0);
                }}
              >
                <X className="mr-1 h-4 w-4" /> {tc("clear")}
              </Button>
            )}
          </div>

          {/* Entries table */}
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold">{t("noEntriesFound")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("tryAdjustingFilters")}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">
                        {t("serialNo")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("epicNo")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("name")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("fatherOrHusbandName")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("relationType")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("gender")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("age")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("houseNumber")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("section")}
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        {t("entryStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {entry.serial_no ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {entry.epic_no || "—"}
                        </td>
                        <td className="px-4 py-3 font-medium">{entry.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.father_or_husband_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.relation_type || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.gender || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.age ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.house_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.section || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.status ? (
                            <Badge variant="outline">{entry.status}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {tc("showing", { from, to, total: totalEntries })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> {tc("previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={to >= totalEntries}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {tc("next")} <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

// --- Groups List View ---
function GroupsListView({
  onSelectGroup,
}: {
  onSelectGroup: (id: string) => void;
}) {
  const t = useTranslations("voters");
  const tc = useTranslations("common");
  const formatDate = useFormatDate();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<
    VoterListGroupItem | undefined
  >();
  const deleteGroup = useDeleteVoterListGroup();

  async function handleDeleteConfirm() {
    if (!groupToDelete) return;
    try {
      await deleteGroup.mutateAsync(groupToDelete.id);
      toast.success(t("deleteSuccess"));
      setDeleteDialogOpen(false);
      setGroupToDelete(undefined);
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  const [isPolling, setIsPolling] = useState(false);

  const { data, isLoading } = useVoterListGroups({
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
    refetchInterval: isPolling ? 5000 : false,
  });

  // Start/stop polling based on whether any group is processing
  const hasProcessing =
    data?.items?.some((g) => g.status === "processing") ?? false;
  useEffect(() => {
    setIsPolling(hasProcessing);
  }, [hasProcessing]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasFilters = searchQuery || statusFilter;
  const from = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchConstituency")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="pl-9 w-64"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t("allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="processing">{t("processing")}</SelectItem>
            <SelectItem value="completed">{t("completed")}</SelectItem>
            <SelectItem value="failed">{t("failed")}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("");
              setPage(0);
            }}
          >
            <X className="mr-1 h-4 w-4" /> {tc("clear")}
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-md border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b px-4 py-3 last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">
            {hasFilters ? t("noEntriesFound") : t("noVoterListsYet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? t("tryAdjustingFilters") : t("uploadFirstList")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">
                    {t("constituency")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("partNo")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("partName")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("year")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("status")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("voterCount")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    {t("createdAt")}
                  </th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: VoterListGroupItem) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">
                      {item.constituency}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.part_no || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.part_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.year}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {item.voter_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectGroup(item.id)}
                        >
                          {t("viewDetails")}
                        </Button>
                        <PermissionGate permission="voters:write">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setGroupToDelete(item);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tc("showing", { from, to, total })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> {tc("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={to >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc("next")} <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        onConfirm={handleDeleteConfirm}
        isPending={deleteGroup.isPending}
      />
    </div>
  );
}

// --- Main Page ---
export default function VoterUploadPage() {
  const t = useTranslations("voters");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  if (selectedGroupId) {
    return (
      <div className="space-y-6">
        <GroupDetailView
          groupId={selectedGroupId}
          onBack={() => setSelectedGroupId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("voterListUpload")}</h1>

      <PermissionGate permission="voters:write">
        <UploadForm />
      </PermissionGate>

      <Card>
        <CardHeader>
          <CardTitle>{t("voterLists")}</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupsListView onSelectGroup={setSelectedGroupId} />
        </CardContent>
      </Card>
    </div>
  );
}
