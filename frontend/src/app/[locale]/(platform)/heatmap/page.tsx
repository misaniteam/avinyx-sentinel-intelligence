'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHeatmapData, useVoterLocationStats } from '@/lib/api/hooks';
import { useTenant } from '@/lib/tenant/tenant-provider';
import MapProvider from '@/components/heatmap/map-provider';
import SentimentHeatmap from '@/components/heatmap/sentiment-heatmap';
import HeatmapControls from '@/components/heatmap/heatmap-controls';
import VoterStatsMarkers from '@/components/heatmap/voter-stats-markers';
import { useTranslations } from 'next-intl';

export default function HeatmapPage() {
  const t = useTranslations('analytics');
  const [sentimentFilter, setSentimentFilter] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { constituency } = useTenant();

  const { data, isLoading } = useHeatmapData(
    sentimentFilter,
    dateFrom || undefined,
    dateTo || undefined,
  );

  const { data: voterStats } = useVoterLocationStats();

  const center = constituency
    ? { lat: constituency.lat, lng: constituency.lng }
    : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('sentimentHeatmap')}</h1>

      <HeatmapControls
        sentimentFilter={sentimentFilter}
        onSentimentFilterChange={setSentimentFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('geographicSentiment')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[600px] p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {t('loadingHeatmap')}
            </div>
          ) : (
            <MapProvider>
              <SentimentHeatmap
                data={data ?? []}
                center={center}
                zoom={constituency ? 12 : undefined}
              >
                {voterStats && voterStats.length > 0 && (
                  <VoterStatsMarkers data={voterStats} />
                )}
              </SentimentHeatmap>
            </MapProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
