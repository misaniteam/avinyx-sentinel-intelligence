'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MapProviderProps {
  children: React.ReactNode;
}

export default function MapProvider({ children }: MapProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Maps Unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[400px] text-muted-foreground">
          Google Maps API key not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment.
        </CardContent>
      </Card>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={['visualization']}>
      {children}
    </APIProvider>
  );
}
