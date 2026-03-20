"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HeatmapPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Sentiment Heatmap</h1>
      <Card>
        <CardHeader>
          <CardTitle>Geographic Sentiment Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-[600px] flex items-center justify-center text-muted-foreground">
          Google Maps Heatmap will be rendered here.
          <br />
          Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY configuration.
        </CardContent>
      </Card>
    </div>
  );
}
