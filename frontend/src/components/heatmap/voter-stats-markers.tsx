'use client';

import { useState } from 'react';
import { AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { useTranslations } from 'next-intl';
import type { VoterLocationStats } from '@/types';
import { Users, UserRound, Calendar, BarChart3 } from 'lucide-react';

function StatsMarker({ stats }: { stats: VoterLocationStats }) {
  const t = useTranslations('analytics');
  const [open, setOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: stats.lat, lng: stats.lng }}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform">
          <Users className="h-4 w-4" />
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
              <h3 className="font-semibold text-base text-gray-900">
                {stats.location_name ?? t('voterStats.unknownLocation')}
              </h3>
              {(stats.part_no || stats.part_name) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.part_no && `#${stats.part_no}`}
                  {stats.part_no && stats.part_name && ' — '}
                  {stats.part_name}
                </p>
              )}
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
                    .map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 uppercase tracking-wide">{status}</span>
                        <span className="font-semibold text-gray-800 tabular-nums">{count.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              </div>
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
