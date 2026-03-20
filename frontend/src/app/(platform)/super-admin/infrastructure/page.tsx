"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Infrastructure</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Service Health</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            Microservice health status overview.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Queue Metrics</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            SQS queue depths and DLQ monitoring.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
