"use client";

import { useMemo, useState } from "react";
import { useMediaFeeds, useMediaFeedTopics, useDeleteMediaFeed } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { platformConfig } from "@/lib/constants/platforms";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Youtube,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { YouTubeCarousel } from "@/components/media/youtube-carousel";
import { toast } from "sonner";
import type { MediaFeedItem } from "@/types";

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "published_at:desc", labelKey: "newestFirst" },
  { value: "published_at:asc", labelKey: "oldestFirst" },
  { value: "sentiment_score:desc", labelKey: "highestSentiment" },
  { value: "sentiment_score:asc", labelKey: "lowestSentiment" },
  { value: "platform:asc", labelKey: "platformAZ" },
] as const;

function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

function getSentimentCategory(item: MediaFeedItem): "positive" | "negative" | "neutral" {
  if (item.sentiment_label === "positive") return "positive";
  if (item.sentiment_label === "negative") return "negative";
  return "neutral";
}

function FeedCard({ item, highlighted = false, onDelete }: { item: MediaFeedItem; highlighted?: boolean; onDelete?: (item: MediaFeedItem) => void }) {
  const tc = useTranslations("common");
  const platform = platformConfig[item.platform];
  const sentimentCategory = getSentimentCategory(item);
  const isYouTube = item.platform === "youtube";
  const commentSentiment = item.engagement?.comment_sentiment;

  return (
    <Card className={`relative group ${highlighted ? "border-2 border-primary/40 shadow-md" : ""}`}>
      {onDelete && (
        <button
          onClick={() => onDelete(item)}
          className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title={tc("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <CardContent className="flex items-start gap-4 p-4">
        {item.image_url && (
          <img
            src={item.image_url}
            alt=""
            className={`rounded-md object-cover flex-shrink-0 ${highlighted ? "w-28 h-28" : "w-20 h-20"}`}
          />
        )}
        {highlighted && !item.image_url && isYouTube && (
          <div className="w-28 h-28 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <Youtube className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platform?.color || "bg-gray-100 text-gray-800"}`}>
              {platform?.label || item.platform}
            </span>
            {item.sentiment_label && (
              <span className={`text-xs font-medium flex items-center gap-1 ${
                sentimentCategory === "positive" ? "text-green-600 dark:text-green-400" :
                sentimentCategory === "negative" ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground"
              }`}>
                {sentimentCategory === "positive" && <TrendingUp className="h-3 w-3" />}
                {sentimentCategory === "negative" && <TrendingDown className="h-3 w-3" />}
                {item.sentiment_label} ({item.sentiment_score?.toFixed(2)})
              </span>
            )}
            {commentSentiment && (
              <span
                className={`text-xs font-medium flex items-center gap-1 ${
                  commentSentiment.sentiment_label === "positive" ? "text-green-600 dark:text-green-400" :
                  commentSentiment.sentiment_label === "negative" ? "text-red-600 dark:text-red-400" :
                  "text-muted-foreground"
                }`}
                title={commentSentiment.summary}
              >
                <MessageSquare className="h-3 w-3" />
                {tc("comments")} {commentSentiment.sentiment_label} ({commentSentiment.sentiment_score.toFixed(2)})
              </span>
            )}
            {highlighted && (
              <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">
                Top
              </Badge>
            )}
          </div>

          <div>
            {item.source_link ? (
              <a href={item.source_link} target="_blank" rel="noopener noreferrer" className={`font-semibold hover:underline ${highlighted ? "text-base" : "text-sm"}`}>
                {item.title ? decodeHtmlEntities(item.title) : tc("noContent")}
              </a>
            ) : (
              <p className={`font-semibold ${highlighted ? "text-base" : "text-sm"}`}>
                {item.title ? decodeHtmlEntities(item.title) : tc("noContent")}
              </p>
            )}
            {item.description && (
              <p className={`text-sm text-muted-foreground mt-0.5 ${highlighted ? "line-clamp-3" : "line-clamp-2"}`}>
                {decodeHtmlEntities(item.description)}
              </p>
            )}
          </div>

          {item.summary && highlighted && (
            <p className="text-xs text-muted-foreground italic line-clamp-2">
              {item.summary}
            </p>
          )}

          {commentSentiment?.summary && highlighted && (
            <p className="text-xs text-muted-foreground italic line-clamp-2 flex items-start gap-1">
              <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
              {commentSentiment.summary}
            </p>
          )}

          {item.topics && item.topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.topics.slice(0, 5).map((topic) => (
                <Badge key={topic} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {topic}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{item.author || tc("unknown")}</span>
            {item.published_at && (
              <span>{new Date(item.published_at).toLocaleDateString()}</span>
            )}
            {item.external_links && item.external_links.length > 0 && (
              <div className="flex items-center gap-1">
                {item.external_links.slice(0, 3).map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex gap-2 text-theme-primary" title={link}>
                    <ExternalLink className="h-3 w-3" />
                    <span>External Link</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MediaFeedsPage() {
  const t = useTranslations("navigation");
  const tc = useTranslations("common");

  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortValue, setSortValue] = useState<string>("published_at:desc");
  const [page, setPage] = useState(0);
  const [feedToDelete, setFeedToDelete] = useState<MediaFeedItem | null>(null);
  const deleteFeed = useDeleteMediaFeed();

  const [sortBy, sortOrder] = sortValue.split(":") as [string, string];

  const { data, isLoading } = useMediaFeeds({
    platform: platformFilter || undefined,
    sentiment: sentimentFilter || undefined,
    topic: topicFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const { data: topics } = useMediaFeedTopics();

  const feeds = data?.items;
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // On first page with no sentiment filter, show highlighted section
  const showHighlights = page === 0 && !sentimentFilter && !topicFilter;

  const { highlighted, youtubeVideos, rest } = useMemo(() => {
    if (!feeds || feeds.length === 0 || !showHighlights)
      return { highlighted: [], youtubeVideos: [], rest: feeds || [] };

    const positiveOrNegative = feeds.filter((f) => getSentimentCategory(f) !== "neutral");

    const sorted = [...positiveOrNegative].sort((a, b) => {
      const scoreA = Math.abs(a.sentiment_score ?? 0);
      const scoreB = Math.abs(b.sentiment_score ?? 0);
      return scoreB - scoreA;
    });

    // Collect top YouTube videos for carousel
    const ytVideos = sorted.filter((f) => f.platform === "youtube").slice(0, 10);
    const ytIds = new Set(ytVideos.map((f) => f.id));

    const othersTop = sorted.filter((f) => f.platform !== "youtube");
    const highlightedIds = new Set<string>();
    const highlightedItems: MediaFeedItem[] = [];

    for (const item of othersTop) {
      if (highlightedItems.length >= 4) break;
      highlightedItems.push(item);
      highlightedIds.add(item.id);
    }

    const remaining = feeds.filter((f) => !highlightedIds.has(f.id) && !ytIds.has(f.id));
    return { highlighted: highlightedItems, youtubeVideos: ytVideos, rest: remaining };
  }, [feeds, showHighlights]);

  const platformOptions = Object.entries(platformConfig).map(([key, val]) => ({
    value: key,
    label: val.label,
  }));

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value === "all" ? "" : value);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("mediaFeeds")}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={platformFilter || "all"} onValueChange={handleFilterChange(setPlatformFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={tc("allPlatforms")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("allPlatforms")}</SelectItem>
            {platformOptions.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sentimentFilter || "all"} onValueChange={handleFilterChange(setSentimentFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={tc("allSentiments")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("allSentiments")}</SelectItem>
            <SelectItem value="positive">{tc("positive")}</SelectItem>
            <SelectItem value="negative">{tc("negative")}</SelectItem>
            <SelectItem value="neutral">{tc("neutral")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={topicFilter || "all"} onValueChange={handleFilterChange(setTopicFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={tc("allTopics")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("allTopics")}</SelectItem>
            {topics?.map((topic) => (
              <SelectItem key={topic} value={topic}>{topic}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Label htmlFor="date-from" className="text-sm font-medium whitespace-nowrap">{tc("from")}</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="w-[145px] h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="date-to" className="text-sm font-medium whitespace-nowrap">{tc("to")}</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="w-[145px] h-9"
          />
        </div>

        <Select value={sortValue} onValueChange={(v) => { setSortValue(v); setPage(0); }}>
          <SelectTrigger className="w-[190px]">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{tc(opt.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(platformFilter || sentimentFilter || topicFilter || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPlatformFilter("");
              setSentimentFilter("");
              setTopicFilter("");
              setDateFrom("");
              setDateTo("");
              setPage(0);
            }}
          >
            {tc("clear")}
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {total > 0 && tc("showing", {
            from: page * PAGE_SIZE + 1,
            to: Math.min((page + 1) * PAGE_SIZE, total),
            total,
          })}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* YouTube video carousel */}
          {youtubeVideos.length > 0 && <YouTubeCarousel videos={youtubeVideos} />}

          {/* Highlighted top items (first page, no filters) */}
          {highlighted.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">{tc("topHighlights")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highlighted.map((item) => (
                  <FeedCard key={item.id} item={item} highlighted onDelete={setFeedToDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Feed items */}
          {rest.length > 0 && (
            <div className="space-y-4">
              {showHighlights && highlighted.length > 0 && (
                <h2 className="text-lg font-semibold">{tc("allFeeds")}</h2>
              )}
              {rest.map((item) => (
                <FeedCard key={item.id} item={item} onDelete={setFeedToDelete} />
              ))}
            </div>
          )}

          {(!feeds || feeds.length === 0) && (
            <p className="text-muted-foreground text-center py-12">
              {platformFilter || sentimentFilter || topicFilter
                ? tc("noResults")
                : t("noMediaItemsYet")}
            </p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {tc("previous")}
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {tc("page")} {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {tc("next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <DeleteConfirmDialog
        open={!!feedToDelete}
        onOpenChange={(open) => { if (!open) setFeedToDelete(null); }}
        title={tc("delete")}
        description={tc("deleteMediaFeedConfirm")}
        onConfirm={() => {
          if (!feedToDelete) return;
          deleteFeed.mutate(feedToDelete.id, {
            onSuccess: () => {
              toast.success(tc("mediaFeedDeleted"));
              setFeedToDelete(null);
            },
            onError: () => {
              toast.error(tc("failedDeleteMediaFeed"));
            },
          });
        }}
        isPending={deleteFeed.isPending}
      />
    </div>
  );
}
