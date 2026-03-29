"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Youtube,
} from "lucide-react";
import type { MediaFeedItem } from "@/types";

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getVideoId(item: MediaFeedItem): string | null {
  if (item.source_link) {
    const id = extractYouTubeId(item.source_link);
    if (id) return id;
  }
  for (const link of item.external_links || []) {
    const id = extractYouTubeId(link);
    if (id) return id;
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  const el = document.createElement("textarea");
  el.innerHTML = text;
  return el.value;
}

export function YouTubeCarousel({ videos }: { videos: MediaFeedItem[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" }, [
    Autoplay({ delay: 6000, stopOnInteraction: true }),
  ]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (videos.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold">Top YouTube Videos</h2>
          <Badge variant="secondary" className="text-xs">
            {videos.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canScrollPrev}
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canScrollNext}
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {videos.map((item) => {
            const videoId = getVideoId(item);
            const sentimentCategory = item.sentiment_label || "neutral";

            return (
              <div
                key={item.id}
                className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
              >
                <Card className="h-full">
                  {videoId ? (
                    <div className="aspect-video w-full">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoId}`}
                        title={item.title || "YouTube video"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full rounded-t-lg"
                      />
                    </div>
                  ) : item.image_url ? (
                    <div className="aspect-video w-full relative">
                      <img
                        src={item.image_url}
                        alt={item.title || ""}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/60 rounded-full p-3">
                          <Youtube className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center rounded-t-lg">
                      <Youtube className="h-12 w-12 text-red-400" />
                    </div>
                  )}

                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        YouTube
                      </span>
                      {item.sentiment_label && (
                        <span
                          className={`text-xs font-medium flex items-center gap-1 ${
                            sentimentCategory === "positive"
                              ? "text-green-600 dark:text-green-400"
                              : sentimentCategory === "negative"
                                ? "text-red-600 dark:text-red-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {sentimentCategory === "positive" && (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {sentimentCategory === "negative" && (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {item.sentiment_label} ({item.sentiment_score?.toFixed(2)})
                        </span>
                      )}
                    </div>

                    <div>
                      {item.source_link ? (
                        <a
                          href={item.source_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm hover:underline line-clamp-2"
                        >
                          {item.title
                            ? decodeHtmlEntities(item.title)
                            : "Untitled video"}
                        </a>
                      ) : (
                        <p className="font-semibold text-sm line-clamp-2">
                          {item.title
                            ? decodeHtmlEntities(item.title)
                            : "Untitled video"}
                        </p>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {decodeHtmlEntities(item.description)}
                      </p>
                    )}

                    {item.topics && item.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.topics.slice(0, 3).map((topic) => (
                          <Badge
                            key={topic}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>{item.author || "Unknown"}</span>
                      <div className="flex items-center gap-2">
                        {item.published_at && (
                          <span>
                            {new Date(item.published_at).toLocaleDateString()}
                          </span>
                        )}
                        {item.source_link && (
                          <a
                            href={item.source_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground"
                            title="Watch on YouTube"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {videos.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {videos.map((_, i) => (
            <button
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === selectedIndex
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
              onClick={() => emblaApi?.scrollTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
