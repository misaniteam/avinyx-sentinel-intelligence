'use client';

import { useEffect, useRef } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import type { HeatmapPoint } from '@/types';

interface SentimentHeatmapProps {
  data: HeatmapPoint[];
  radius?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
}

function HeatmapLayer({ data, radius = 30 }: { data: HeatmapPoint[]; radius?: number }) {
  const map = useMap();
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  // Create the layer once when the map is available; destroy on unmount
  useEffect(() => {
    if (!map || !window.google?.maps?.visualization) return;

    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      map,
      dissipating: true,
    });

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [map]);

  // Update data and options whenever they change
  useEffect(() => {
    if (!heatmapRef.current) return;

    const points = data.map((p) => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: p.weight,
    }));

    heatmapRef.current.setData(points);
    heatmapRef.current.setOptions({ radius });
  }, [data, radius]);

  return null;
}

export default function SentimentHeatmap({ data, radius = 30, center, zoom }: SentimentHeatmapProps) {
  return (
    <Map
      defaultCenter={center ?? { lat: 20.5937, lng: 78.9629 }}
      defaultZoom={zoom ?? 5}
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: '100%', height: '100%' }}
    >
      <HeatmapLayer data={data} radius={radius} />
    </Map>
  );
}
