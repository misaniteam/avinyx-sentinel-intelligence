'use client';

import { useMemo } from 'react';
import { useMediaFeeds } from '@/lib/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import { platformConfig } from '@/lib/constants/platforms';
import { TrendingUp, TrendingDown, Youtube, ExternalLink } from 'lucide-react';
import type { MediaFeedItem } from '@/types';

function decodeHtmlEntities(text: string): string {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function TopFeedCard({ item }: { item: MediaFeedItem }) {
  const tc = useTranslations('common');
  const platform = platformConfig[item.platform];
  const isPositive = item.sentiment_label === 'positive';
  const isYouTube = item.platform === 'youtube';

  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${
      isPositive
        ? 'border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-green-950/20'
        : 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
    }`}>
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
        />
      ) : isYouTube ? (
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-red-100 dark:bg-red-900/30">
          <Youtube className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${platform?.color || 'bg-gray-100 text-gray-800'}`}>
            {platform?.label || item.platform}
          </span>
          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {item.sentiment_score?.toFixed(2)}
          </span>
        </div>
        <div>
          {item.source_link ? (
            <a
              href={item.source_link}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-1 text-xs font-semibold hover:underline"
            >
              {item.title ? decodeHtmlEntities(item.title) : tc('noContent')}
            </a>
          ) : (
            <p className="line-clamp-1 text-xs font-semibold">
              {item.title ? decodeHtmlEntities(item.title) : tc('noContent')}
            </p>
          )}
          {item.description && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">
              {decodeHtmlEntities(item.description)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {item.author && <span>{item.author}</span>}
          {item.published_at && <span>{new Date(item.published_at).toLocaleDateString()}</span>}
          {item.topics?.length > 0 && (
            <div className="flex gap-0.5">
              {item.topics.slice(0, 2).map((topic) => (
                <Badge key={topic} variant="secondary" className="px-1 py-0 text-[9px]">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopFeedsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function TopFeedsWidget() {
  const t = useTranslations('dashboard');
  const { data, isLoading } = useMediaFeeds({ skip: 0, limit: 50 });

  const { topNews, topYouTube } = useMemo(() => {
    if (!data?.items) return { topNews: [], topYouTube: [] };

    const nonNeutral = data.items.filter(
      (f) => f.sentiment_label === 'positive' || f.sentiment_label === 'negative'
    );

    const sorted = [...nonNeutral].sort(
      (a, b) => Math.abs(b.sentiment_score ?? 0) - Math.abs(a.sentiment_score ?? 0)
    );

    const youtube = sorted.filter((f) => f.platform === 'youtube').slice(0, 2);
    const news = sorted.filter((f) => f.platform !== 'youtube').slice(0, 2);

    return { topNews: news, topYouTube: youtube };
  }, [data]);

  if (isLoading) return <TopFeedsSkeleton />;

  const allItems = [...topYouTube, ...topNews];

  if (allItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('noTopFeeds')}
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-auto">
      {topYouTube.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Youtube className="h-3 w-3 text-red-500" />
            {t('topYouTube')}
          </p>
          <div className="space-y-2">
            {topYouTube.map((item) => (
              <TopFeedCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
      {topNews.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <ExternalLink className="h-3 w-3" />
            {t('topNews')}
          </p>
          <div className="space-y-2">
            {topNews.map((item) => (
              <TopFeedCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
