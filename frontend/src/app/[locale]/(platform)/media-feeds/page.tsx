"use client";

import { useMemo, useState } from "react";
import { useMediaFeeds } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslations } from "next-intl";
import { platformConfig } from "@/lib/constants/platforms";
import { ExternalLink, TrendingUp, TrendingDown, Youtube } from "lucide-react";
import type { MediaFeedItem } from "@/types";

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

function FeedCard({ item, highlighted = false }: { item: MediaFeedItem; highlighted?: boolean }) {
  const tc = useTranslations("common");
  const platform = platformConfig[item.platform];
  const sentimentCategory = getSentimentCategory(item);
  const isYouTube = item.platform === "youtube";

  return (
    <Card className={highlighted ? "border-2 border-primary/40 shadow-md" : ""}>
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
          <div className="flex items-center gap-2">
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
  const { data, isLoading } = useMediaFeeds();
  const feeds = data?.items;
  const [showNeutral, setShowNeutral] = useState(false);

  const { highlighted, nonNeutral, neutral } = useMemo(() => {
    if (!feeds || feeds.length === 0) return { highlighted: [], nonNeutral: [], neutral: [] };

    const positiveOrNegative = feeds.filter((f) => getSentimentCategory(f) !== "neutral");
    const neutralItems = feeds.filter((f) => getSentimentCategory(f) === "neutral");

    // Sort by absolute sentiment score descending to get most extreme sentiments
    const sorted = [...positiveOrNegative].sort((a, b) => {
      const scoreA = Math.abs(a.sentiment_score ?? 0);
      const scoreB = Math.abs(b.sentiment_score ?? 0);
      return scoreB - scoreA;
    });

    // Pick top 1-4 highlighted items, preferring YouTube
    const youtubeTop = sorted.filter((f) => f.platform === "youtube");
    const othersTop = sorted.filter((f) => f.platform !== "youtube");
    const highlightedIds = new Set<string>();
    const highlightedItems: MediaFeedItem[] = [];

    // Add top YouTube items first (up to 2)
    for (const item of youtubeTop) {
      if (highlightedItems.length >= 4) break;
      highlightedItems.push(item);
      highlightedIds.add(item.id);
    }
    // Fill remaining with other platforms
    for (const item of othersTop) {
      if (highlightedItems.length >= 4) break;
      highlightedItems.push(item);
      highlightedIds.add(item.id);
    }

    const remaining = positiveOrNegative.filter((f) => !highlightedIds.has(f.id));

    return { highlighted: highlightedItems, nonNeutral: remaining, neutral: neutralItems };
  }, [feeds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("mediaFeeds")}</h1>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={showNeutral}
            onCheckedChange={(checked) => setShowNeutral(checked === true)}
          />
          <span className="text-sm text-muted-foreground">
            {tc("showNeutral") ?? "Show neutral items"}
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Highlighted top items */}
          {highlighted.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">{tc("topHighlights") ?? "Top Highlights"}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highlighted.map((item) => (
                  <FeedCard key={item.id} item={item} highlighted />
                ))}
              </div>
            </div>
          )}

          {/* Remaining non-neutral items */}
          {nonNeutral.length > 0 && (
            <div className="space-y-4">
              {highlighted.length > 0 && (
                <h2 className="text-lg font-semibold">{tc("allFeeds") ?? "All Feeds"}</h2>
              )}
              {nonNeutral.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Neutral items (toggled) */}
          {showNeutral && neutral.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-muted-foreground">
                {tc("neutralItems") ?? "Neutral Items"} ({neutral.length})
              </h2>
              {neutral.map((item) => (
                <FeedCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {(!feeds || feeds.length === 0) && (
            <p className="text-muted-foreground text-center py-12">{t("noMediaItemsYet")}</p>
          )}

          {feeds && feeds.length > 0 && nonNeutral.length === 0 && highlighted.length === 0 && !showNeutral && (
            <p className="text-muted-foreground text-center py-12">
              {tc("onlyNeutralItems") ?? "All items are neutral. Check \"Show neutral items\" to see them."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
