"use client";

import { useMediaFeeds } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MediaFeedsPage() {
  const { data: feeds, isLoading } = useMediaFeeds();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Media Feeds</h1>
      {isLoading ? (
        <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {feeds?.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                  item.platform === "youtube" ? "bg-red-100 text-red-800" :
                  item.platform === "brand24" ? "bg-blue-100 text-blue-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {item.platform}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{item.content || "No content"}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{item.author || "Unknown"}</span>
                    {item.sentiment_label && (
                      <span className={`font-medium ${
                        item.sentiment_label === "positive" ? "text-green-600" :
                        item.sentiment_label === "negative" ? "text-red-600" :
                        "text-gray-600"
                      }`}>
                        {item.sentiment_label} ({item.sentiment_score?.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!feeds || feeds.length === 0) && (
            <p className="text-muted-foreground text-center py-12">No media items yet. Configure data sources to start ingesting.</p>
          )}
        </div>
      )}
    </div>
  );
}
