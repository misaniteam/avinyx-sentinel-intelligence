'use client';

import { useState } from 'react';
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';
import type { VoterLocationStats } from '@/types';
import { Users, UserRound, Calendar, BarChart3, Loader2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
};

function StatsMarker({ stats }: { stats: VoterLocationStats }) {
  const t = useTranslations('analytics');
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const isProcessing = stats.status !== 'completed';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: stats.lat, lng: stats.lng }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-full shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform ${isProcessing ? 'bg-yellow-500 text-white' : 'bg-primary text-primary-foreground'}`}>
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        </div>
      </AdvancedMarker>

      {open && (
        <InfoWindow
          anchor={marker}
          onCloseClick={() => setOpen(false)}
          headerDisabled
        >
          <div className="min-w-[240px] max-w-[300px] p-1 text-sm">
            {/* Header */}
            <div className="mb-2 border-b pb-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-base text-gray-900">
                  {stats.location_name ?? t('voterStats.unknownLocation')}
                </h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[stats.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {stats.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {stats.year}
                {stats.part_no && ` \u00B7 #${stats.part_no}`}
                {stats.part_name && ` \u00B7 ${stats.part_name}`}
              </p>
            </div>

            {/* Total */}
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="font-medium text-gray-900">
                {t('voterStats.totalVoters')}:
              </span>
              <span className="font-bold text-blue-600 ml-auto">
                {stats.total_count.toLocaleString()}
              </span>
            </div>

            {stats.total_count > 0 && (
              <>
                {/* Gender breakdown */}
                <div className="mb-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-sky-600 shrink-0" />
                    <span className="text-gray-700">{t('voterStats.male')}:</span>
                    <span className="font-semibold ml-auto">{stats.male_count.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-pink-500 shrink-0" />
                    <span className="text-gray-700">{t('voterStats.female')}:</span>
                    <span className="font-semibold ml-auto">{stats.female_count.toLocaleString()}</span>
                  </div>
                  {stats.other_gender_count > 0 && (
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-purple-500 shrink-0" />
                      <span className="text-gray-700">{t('voterStats.other')}:</span>
                      <span className="font-semibold ml-auto">{stats.other_gender_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Average age */}
                {stats.average_age !== null && (
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-gray-700">{t('voterStats.avgAge')}:</span>
                    <span className="font-semibold ml-auto">{stats.average_age}</span>
                  </div>
                )}

                {/* Status counts */}
                {Object.keys(stats.status_counts).length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-gray-600 shrink-0" />
                      <span className="font-medium text-gray-900">{t('voterStats.statusBreakdown')}</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {Object.entries(stats.status_counts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([entryStatus, count]) => (
                          <div key={entryStatus} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 uppercase tracking-wide">{entryStatus}</span>
                            <span className="font-semibold text-gray-800 tabular-nums">{count.toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface VoterStatsMarkersProps {
  data: VoterLocationStats[];
}

export default function VoterStatsMarkers({ data }: VoterStatsMarkersProps) {
  return (
    <>
      {data.map((stats) => (
        <StatsMarker key={stats.group_id} stats={stats} />
      ))}
    </>
  );
}
