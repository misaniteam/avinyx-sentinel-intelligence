'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server } from "lucide-react";
import { useTranslations } from "next-intl";

interface ServiceHealthCardProps {
  serviceName: string;
  displayName: string;
  port: number;
  description?: string;
  status?: "healthy" | "unhealthy" | "unreachable";
  responseTimeMs?: number | null;
  isLoading?: boolean;
}

const statusConfig = {
  healthy: { color: "bg-green-500", key: "statusHealthy" },
  unhealthy: { color: "bg-red-500", key: "statusUnhealthy" },
  unreachable: { color: "bg-yellow-500", key: "statusUnreachable" },
} as const;

export function ServiceHealthCard({
  serviceName,
  displayName,
  port,
  description,
  status,
  responseTimeMs,
  isLoading,
}: ServiceHealthCardProps) {
  const t = useTranslations("superAdmin.infrastructure");

  const dotColor = isLoading || !status
    ? "bg-muted-foreground/50"
    : statusConfig[status].color;

  const statusText = isLoading
    ? t("statusChecking")
    : status
      ? t(statusConfig[status].key)
      : t("statusChecking");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
        <Server className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-1">
          <span className={`h-2 w-2 rounded-full ${dotColor} ${isLoading ? "animate-pulse" : ""}`} />
          <span className={`text-xs ${status === "healthy" ? "text-green-600 dark:text-green-400" : status === "unhealthy" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            {statusText}
          </span>
          {responseTimeMs != null && (
            <span className="text-xs text-muted-foreground ml-auto">
              {responseTimeMs}ms
            </span>
          )}
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
