"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>AI Provider</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            Configure AI provider (Claude, OpenAI, Bedrock) and model settings.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Data Sources</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            Manage data source API keys and polling intervals.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            Configure alert thresholds and notification channels.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            Tenant display name, timezone, and general preferences.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
