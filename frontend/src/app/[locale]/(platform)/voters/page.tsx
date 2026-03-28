"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAllVoterEntries, useVoterListGroups } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
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
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  FileDown,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useExport } from "@/lib/export/use-export";
import { downloadBlob } from "@/lib/export/client-export";
import type { AllVoterEntriesResponse } from "@/types";
import { api } from "@/lib/api/client";

const PAGE_SIZE = 50;

function buildExportUrl(params: {
  search?: string;
  gender?: string;
  status?: string;
  group_id?: string;
  age_min?: number;
  age_max?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.gender) sp.set("gender", params.gender);
  if (params.status) sp.set("status", params.status);
  if (params.group_id) sp.set("group_id", params.group_id);
  if (params.age_min) sp.set("age_min", String(params.age_min));
  if (params.age_max) sp.set("age_max", String(params.age_max));
  sp.set("limit", "10000");
  const qs = sp.toString();
  return `api/ingestion/voter-lists/entries/all${qs ? `?${qs}` : ""}`;
}

export default function VotersPage() {
  const t = useTranslations("voters");
  const tc = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [page, setPage] = useState(0);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const { exportToPdf, isExporting: isExportingPdf } = useExport();

  const ageMinNum = ageMin ? parseInt(ageMin, 10) : undefined;
  const ageMaxNum = ageMax ? parseInt(ageMax, 10) : undefined;

  const { data, isLoading } = useAllVoterEntries({
    search: searchQuery || undefined,
    gender: genderFilter || undefined,
    status: statusFilter || undefined,
    group_id: groupFilter || undefined,
    age_min: ageMinNum,
    age_max: ageMaxNum,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const { data: groupsData } = useVoterListGroups({ limit: 100 });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const from = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  const hasFilters = searchQuery || genderFilter || statusFilter || groupFilter || ageMin || ageMax;

  const filterParams = {
    search: searchQuery || undefined,
    gender: genderFilter || undefined,
    status: statusFilter || undefined,
    group_id: groupFilter || undefined,
    age_min: ageMinNum,
    age_max: ageMaxNum,
  };

  const clearFilters = () => {
    setSearchQuery("");
    setGenderFilter("");
    setStatusFilter("");
    setGroupFilter("");
    setAgeMin("");
    setAgeMax("");
    setPage(0);
  };

  const handleExportPdf = async () => {
    if (!tableRef.current) return;
    try {
      const { captureElement, canvasToPdf, downloadBlob: dl } = await import("@/lib/export/client-export");
      const canvas = await captureElement(tableRef.current);
      const blob = canvasToPdf(canvas, t("title"));
      dl(blob, `voters-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportFailed"));
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const url = buildExportUrl(filterParams);
      const res = await api.get(url).json<AllVoterEntriesResponse>();
      const rows = res.items.map((e) => ({
        [t("serialNo")]: e.serial_no ?? "",
        [t("epicNo")]: e.epic_no ?? "",
        [t("name")]: e.name,
        [t("fatherOrHusbandName")]: e.father_or_husband_name ?? "",
        [t("relationType")]: e.relation_type ?? "",
        [t("gender")]: e.gender ?? "",
        [t("age")]: e.age ?? "",
        [t("houseNumber")]: e.house_number ?? "",
        [t("section")]: e.section ?? "",
        [t("entryStatus")]: e.status ?? "",
      }));

      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Voters");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(
        new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `voters-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mt-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Badge variant="secondary" className="text-sm">
              <Users className="mr-1 h-3.5 w-3.5" />
              {total.toLocaleString()} {t("voterCount").toLowerCase()}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isExportingPdf || items.length === 0}>
            {isExportingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileDown className="mr-1 h-4 w-4" />}
            {t("exportPdf")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExportingExcel || items.length === 0}>
            {isExportingExcel ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            {t("exportExcel")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3" data-export-hide>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchVoterEntries")}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                className="pl-9 w-72"
              />
            </div>

            <Select value={genderFilter} onValueChange={(val) => { setGenderFilter(val); setPage(0); }}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder={t("allGenders")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">{t("male")}</SelectItem>
                <SelectItem value="Female">{t("female")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t("allStatuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNDER ADJUDICATION">Under Adjudication</SelectItem>
                <SelectItem value="SHIFTED">Shifted</SelectItem>
                <SelectItem value="DELETED">Deleted</SelectItem>
                <SelectItem value="DUPLICATE">Duplicate</SelectItem>
              </SelectContent>
            </Select>

            {groupsData && groupsData.items.length > 0 && (
              <Select value={groupFilter} onValueChange={(val) => { setGroupFilter(val); setPage(0); }}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder={t("allGroups")} />
                </SelectTrigger>
                <SelectContent>
                  {groupsData.items.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.part_no ? `${g.part_no} — ` : ""}{g.constituency} ({g.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder={t("ageMin")}
                value={ageMin}
                onChange={(e) => { setAgeMin(e.target.value); setPage(0); }}
                className="w-20"
                min={0}
                max={150}
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                type="number"
                placeholder={t("ageMax")}
                value={ageMax}
                onChange={(e) => { setAgeMax(e.target.value); setPage(0); }}
                className="w-20"
                min={0}
                max={150}
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" /> {tc("clear")}
              </Button>
            )}
          </div>

          {/* Table */}
          <div ref={tableRef}>
            {isLoading ? (
              <div className="rounded-md border">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-10" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold">
                  {hasFilters ? t("noEntriesFound") : t("noVotersFound")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasFilters ? t("tryAdjustingFilters") : t("uploadFirstList")}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">{t("serialNo")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("epicNo")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("fatherOrHusbandName")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("relationType")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("gender")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("age")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("houseNumber")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("section")}</th>
                      <th className="px-4 py-3 text-left font-medium">{t("entryStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((entry) => (
                      <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{entry.serial_no ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{entry.epic_no || "—"}</td>
                        <td className="px-4 py-3 font-medium">{entry.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.father_or_husband_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.relation_type || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.gender || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.age ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.house_number || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.section || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.status ? <Badge variant="outline">{entry.status}</Badge> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {items.length > 0 && (
            <div className="flex items-center justify-between" data-export-hide>
              <p className="text-sm text-muted-foreground">
                {tc("showing", { from, to, total })}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> {tc("previous")}
                </Button>
                <Button variant="outline" size="sm" disabled={to >= total} onClick={() => setPage((p) => p + 1)}>
                  {tc("next")} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
