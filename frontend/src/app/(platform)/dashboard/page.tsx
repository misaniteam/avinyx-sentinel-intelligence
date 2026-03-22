"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const DashboardGrid = dynamic(
  () => import("@/components/dashboard/dashboard-grid").then((mod) => mod.DashboardGrid),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-lg" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <DashboardGrid />
    </div>
  );
}
