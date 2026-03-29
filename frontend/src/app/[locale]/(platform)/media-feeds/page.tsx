"use client";

import { useMediaFeeds } from "@/lib/api/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";
import { platformConfig } from "@/lib/constants/platforms";
import { LinkifyText } from "@/components/shared/linkify-text";
import { ExternalLink } from "lucide-react";

function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

export default function MediaFeedsPage() {
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const { data, isLoading } = useMediaFeeds();
  const feeds = data?.items;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("mediaFeeds")}</h1>
      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {feeds?.map((item) => {
            const platform = platformConfig[item.platform];
            return (
              <Card key={item.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="w-20 h-20 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platform?.color || "bg-gray-100 text-gray-800"}`}>
                        {platform?.label || item.platform}
                      </span>
                      {item.sentiment_label && (
                        <span className={`text-xs font-medium ${
                          item.sentiment_label === "positive" ? "text-green-600 dark:text-green-400" :
                          item.sentiment_label === "negative" ? "text-red-600 dark:text-red-400" :
                          "text-muted-foreground"
                        }`}>
                          {item.sentiment_label} ({item.sentiment_score?.toFixed(2)})
                        </span>
                      )}
                    </div>

                    <div>
                      {item.source_link ? (
                        <a href={item.source_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-sm hover:underline">
                          {item.title ? decodeHtmlEntities(item.title) : tc("noContent")}
                        </a>
                      ) : (
                        <p className="font-semibold text-sm">
                          {item.title ? decodeHtmlEntities(item.title) : tc("noContent")}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">
                          <LinkifyText text={decodeHtmlEntities(item.description)} />
                        </p>
                      )}
                    </div>

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
                            <a  key={i} href={link} target="_blank" rel="noopener noreferrer" className="hover:text-foreground flex gap-2 text-theme-primary" title={link}>
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
          })}
          {(!feeds || feeds.length === 0) && (
            <p className="text-muted-foreground text-center py-12">{t("noMediaItemsYet")}</p>
          )}
        </div>
      )}
    </div>
  );
}
