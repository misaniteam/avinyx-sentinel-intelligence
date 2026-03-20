'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useHeatmapData } from '@/lib/api/hooks';
import MapProvider from '@/components/heatmap/map-provider';
import SentimentHeatmap from '@/components/heatmap/sentiment-heatmap';
import HeatmapControls from '@/components/heatmap/heatmap-controls';

export default function HeatmapPage() {
  const [sentimentFilter, setSentimentFilter] = useState<string | undefined>(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useHeatmapData(
    sentimentFilter,
    dateFrom || undefined,
    dateTo || undefined,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sentiment Heatmap</h1>

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
          <CardTitle>Geographic Sentiment Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[600px] p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading heatmap data...
            </div>
          ) : (
            <MapProvider>
              <SentimentHeatmap data={data ?? []} />
            </MapProvider>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
