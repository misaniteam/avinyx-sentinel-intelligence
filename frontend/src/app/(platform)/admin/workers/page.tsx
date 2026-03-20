"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminWorkersPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Worker Status</h1>
      <Card>
        <CardHeader><CardTitle>Active Workers</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground">
          Worker status monitoring via Firebase RTDB will be implemented here.
        </CardContent>
      </Card>
    </div>
  );
}
