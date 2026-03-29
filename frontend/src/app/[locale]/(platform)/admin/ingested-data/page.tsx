"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { useIngestedData } from "@/lib/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Inbox,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
} from "lucide-react";
import { platformConfig } from "@/lib/constants/platforms";
import { LinkifyText } from "@/components/shared/linkify-text";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link2 } from "lucide-react";
import type { IngestedDataItem } from "@/types";

/**
 * Parse a url field that may be a single URL string or a JSON array of URLs.
 */
function parseUrls(url: string | null | undefined): string[] {
  if (!url) return [];
  const trimmed = url.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((u: unknown) => typeof u === "string" && u.length > 0);
    } catch { /* not JSON, treat as single URL */ }
  }
  return [trimmed];
}

function UrlLinks({ url }: { url: string | null | undefined }) {
  const urls = parseUrls(url);

  if (urls.length === 0) return <p>—</p>;

  if (urls.length === 1) {
    return (
      <a
        href={urls[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline inline-flex items-center gap-1"
      >
        Open URL <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm">
          <Link2 className="h-3 w-3" />
          {urls.length} Links
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-64 overflow-y-auto p-2" align="start">
        <div className="space-y-1">
          {urls.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:bg-muted rounded px-2 py-1.5 truncate"
              title={u}
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{u}</span>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PAGE_SIZE = 50;

const PLATFORM_OPTIONS = [
  { value: "brand24", label: "Brand24" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "news_rss", label: "News RSS" },
  { value: "news_api", label: "News API" },
  { value: "reddit", label: "Reddit" },
];

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

function truncate(text: string | null, max: number): string {
  if (!text) return "—";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function formatEngagement(engagement: Record<string, number> | null): string {
  if (!engagement || Object.keys(engagement).length === 0) return "—";
  return Object.entries(engagement)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");
}

function ExpandedRow({ item }: { item: IngestedDataItem }) {
  const t = useTranslations("admin.ingestedData");
  const tc = useTranslations("common");
  return (
    <tr className="bg-muted/20">
      <td colSpan={8} className="px-4 py-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="col-span-2">
            <p className="font-medium text-muted-foreground mb-1">{t("content")}</p>
            <p className="whitespace-pre-wrap">{item.content ? <LinkifyText text={item.content} /> : tc("noContent")}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">{t("externalId")}</p>
            <p className="font-mono text-xs">{item.external_id}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">{t("url")}</p>
            <UrlLinks url={item.url} />
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">{tc("region")}</p>
            <p>{item.geo_region || "—"}</p>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">{t("engagement")}</p>
            <p>{formatEngagement(item.engagement)}</p>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function AdminIngestedDataPage() {
  const t = useTranslations("admin.ingestedData");
  const tc = useTranslations("common");
  const formatDate = useFormatDate();

  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useIngestedData({
    platform: platformFilter || undefined,
    search: searchQuery || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasFilters = searchQuery || platformFilter || dateFrom || dateTo;
  const from = total > 0 ? page * PAGE_SIZE + 1 : 0;
  const to = Math.min((page + 1) * PAGE_SIZE, total);

  function clearFilters() {
    setSearchQuery("");
    setPlatformFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {t("title")}{total > 0 ? ` (${total})` : ""}
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label="Search content"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="pl-9 w-64"
          />
        </div>

        <Select
          value={platformFilter}
          onValueChange={(val) => { setPlatformFilter(val); setPage(0); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("allPlatforms")} />
          </SelectTrigger>
          <SelectContent>
            {PLATFORM_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          aria-label="Date from"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className="w-40"
        />
        <span className="text-muted-foreground text-sm">{tc("to")}</span>
        <Input
          type="date"
          aria-label="Date to"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className="w-40"
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" /> {tc("clear")}
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-md border">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">
            {hasFilters ? t("noResultsFound") : t("noIngestedDataYet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters
              ? t("tryAdjustingFilters")
              : t("configureDataSources")}
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium w-10"></th>
                  <th className="px-4 py-3 text-left font-medium w-28">{tc("platform")}</th>
                  <th className="px-4 py-3 text-left font-medium w-[40%]">{t("content")}</th>
                  <th className="px-4 py-3 text-left font-medium w-28">{t("author")}</th>
                  <th className="px-4 py-3 text-left font-medium w-36">{t("published")}</th>
                  <th className="px-4 py-3 text-left font-medium w-28">{tc("region")}</th>
                  <th className="px-4 py-3 text-left font-medium w-24">{tc("status")}</th>
                  <th className="px-4 py-3 text-left font-medium w-36">{t("ingestedAt")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const platform = platformConfig[item.platform] || {
                    label: item.platform,
                    icon: Inbox,
                    color: "bg-gray-100 text-gray-800",
                  };
                  const PlatformIcon = platform.icon;
                  const isExpanded = expandedId === item.id;

                  return (
                    <>
                      <tr
                        key={item.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      >
                        <td className="px-4 py-3">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={platform.color}>
                            <PlatformIcon className="mr-1 h-3 w-3" />
                            {platform.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 overflow-hidden text-ellipsis whitespace-nowrap">{truncate(item.content, 120)}</td>
                        <td className="px-4 py-3 text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{item.author || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(item.published_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">{item.geo_region || "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={
                            item.ai_status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                            item.ai_status === "processing" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                            item.ai_status === "failed" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }>
                            {item.ai_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(item.created_at)}</td>
                      </tr>
                      {isExpanded && <ExpandedRow key={`${item.id}-expanded`} item={item} />}
                    </>
                  );
                })}
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
    </div>
  );
}
