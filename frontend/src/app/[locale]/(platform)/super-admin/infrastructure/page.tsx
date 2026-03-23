"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceHealthCard } from "@/components/admin/service-health-card";
import { useInfrastructureStatus } from "@/lib/api/hooks";
import { Inbox, RefreshCw, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const services = [
  { serviceName: "api-gateway", displayNameKey: "apiGateway", port: 8000, descriptionKey: "apiGatewayDesc" },
  { serviceName: "auth-service", displayNameKey: "authService", port: 8001, descriptionKey: "authServiceDesc" },
  { serviceName: "tenant-service", displayNameKey: "tenantService", port: 8002, descriptionKey: "tenantServiceDesc" },
  { serviceName: "ingestion-service", displayNameKey: "ingestionService", port: 8003, descriptionKey: "ingestionServiceDesc" },
  { serviceName: "analytics-service", displayNameKey: "analyticsService", port: 8005, descriptionKey: "analyticsServiceDesc" },
  { serviceName: "campaign-service", displayNameKey: "campaignService", port: 8006, descriptionKey: "campaignServiceDesc" },
  { serviceName: "notification-service", displayNameKey: "notificationService", port: 8007, descriptionKey: "notificationServiceDesc" },
  { serviceName: "logging-service", displayNameKey: "loggingService", port: 8008, descriptionKey: "loggingServiceDesc" },
] as const;

const queues = [
  { name: "sentinel-ingestion-jobs", descriptionKey: "ingestionJobsDesc" },
  { name: "sentinel-ai-pipeline", descriptionKey: "aiPipelineDesc" },
  { name: "sentinel-notifications", descriptionKey: "notificationsDesc" },
] as const;

export default function InfrastructurePage() {
  const t = useTranslations("superAdmin.infrastructure");
  const { data, isLoading, isError, refetch, isFetching } = useInfrastructureStatus();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-3">
          {data?.checked_at && (
            <span className="text-xs text-muted-foreground">
              {t("lastChecked", { time: formatDistanceToNow(new Date(data.checked_at), { addSuffix: true }) })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {t("fetchError")}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("services")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((svc) => {
            const health = data?.services[svc.serviceName];
            return (
              <ServiceHealthCard
                key={svc.serviceName}
                serviceName={svc.serviceName}
                displayName={t(svc.displayNameKey)}
                port={svc.port}
                description={t(svc.descriptionKey)}
                status={health?.status}
                responseTimeMs={health?.response_time_ms}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("messageQueues")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => {
            const metrics = data?.queues[queue.name];
            return (
              <Card key={queue.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{queue.name}</CardTitle>
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-2">
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-10 mb-1" />
                      ) : (
                        <p className="text-2xl font-bold">
                          {metrics?.messages ?? "--"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{t("messagesInQueue")}</p>
                    </div>
                    <div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-10 mb-1" />
                      ) : (
                        <p className={`text-2xl font-bold ${metrics?.dlq_messages != null && metrics.dlq_messages > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                          {metrics?.dlq_messages ?? t("noDlq")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{t("dlqDepth")}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t(queue.descriptionKey)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
