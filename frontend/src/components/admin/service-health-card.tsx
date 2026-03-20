'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server } from "lucide-react";

interface ServiceHealthCardProps {
  serviceName: string;
  displayName: string;
  port: number;
  description?: string;
}

export function ServiceHealthCard({ serviceName, displayName, port, description }: ServiceHealthCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
        <Server className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">Status unavailable</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {serviceName} &middot; Port {port}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
