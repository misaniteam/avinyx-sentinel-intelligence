"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Platform Breakdown</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Recharts pie chart placeholder
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sentiment Over Time</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Recharts line chart placeholder
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Topics</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Recharts bar chart placeholder
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Engagement Metrics</CardTitle></CardHeader>
          <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
            Recharts area chart placeholder
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
