"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceHealthCard } from "@/components/admin/service-health-card";
import { Inbox } from "lucide-react";

const services = [
  { serviceName: "api-gateway", displayNameKey: "apiGateway", port: 8000, descriptionKey: "apiGatewayDesc" },
  { serviceName: "auth-service", displayNameKey: "authService", port: 8001, descriptionKey: "authServiceDesc" },
  { serviceName: "tenant-service", displayNameKey: "tenantService", port: 8002, descriptionKey: "tenantServiceDesc" },
  { serviceName: "ingestion-service", displayNameKey: "ingestionService", port: 8003, descriptionKey: "ingestionServiceDesc" },
  { serviceName: "analytics-service", displayNameKey: "analyticsService", port: 8005, descriptionKey: "analyticsServiceDesc" },
  { serviceName: "campaign-service", displayNameKey: "campaignService", port: 8006, descriptionKey: "campaignServiceDesc" },
  { serviceName: "notification-service", displayNameKey: "notificationService", port: 8007, descriptionKey: "notificationServiceDesc" },
] as const;

const queues = [
  { name: "sentinel-ingestion-jobs", descriptionKey: "ingestionJobsDesc" },
  { name: "sentinel-ai-pipeline", descriptionKey: "aiPipelineDesc" },
  { name: "sentinel-notifications", descriptionKey: "notificationsDesc" },
] as const;

export default function InfrastructurePage() {
  const t = useTranslations("superAdmin.infrastructure");

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("services")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((svc) => (
            <ServiceHealthCard
              key={svc.serviceName}
              serviceName={svc.serviceName}
              displayName={t(svc.displayNameKey)}
              port={svc.port}
              description={t(svc.descriptionKey)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("messageQueues")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {queues.map((queue) => (
            <Card key={queue.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{queue.name}</CardTitle>
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-2">
                  <div>
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-xs text-muted-foreground">{t("messagesInQueue")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-xs text-muted-foreground">{t("dlqDepth")}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t(queue.descriptionKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
