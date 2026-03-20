"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceHealthCard } from "@/components/admin/service-health-card";
import { Inbox } from "lucide-react";

const services = [
  { serviceName: "api-gateway", displayName: "API Gateway", port: 8000, description: "CORS, rate limiting, reverse proxy" },
  { serviceName: "auth-service", displayName: "Auth Service", port: 8001, description: "Login, JWT, user/role CRUD" },
  { serviceName: "tenant-service", displayName: "Tenant Service", port: 8002, description: "Tenant CRUD, onboarding" },
  { serviceName: "ingestion-service", displayName: "Ingestion Service", port: 8003, description: "Data source CRUD, scheduler" },
  { serviceName: "analytics-service", displayName: "Analytics Service", port: 8005, description: "Dashboard, heatmap, reports" },
  { serviceName: "campaign-service", displayName: "Campaign Service", port: 8006, description: "Campaigns, voters, media feeds" },
  { serviceName: "notification-service", displayName: "Notification Service", port: 8007, description: "Firebase notifications" },
];

const queues = [
  { name: "sentinel-ingestion-jobs", description: "Ingestion scheduler dispatches jobs to workers" },
  { name: "sentinel-ai-pipeline", description: "Worker sends raw items for AI analysis" },
  { name: "sentinel-notifications", description: "AI pipeline triggers notification delivery" },
];

export default function InfrastructurePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Infrastructure</h1>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Services</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {services.map((svc) => (
            <ServiceHealthCard key={svc.serviceName} {...svc} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Message Queues</h2>
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
                    <p className="text-xs text-muted-foreground">Messages in queue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">--</p>
                    <p className="text-xs text-muted-foreground">DLQ depth</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{queue.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
