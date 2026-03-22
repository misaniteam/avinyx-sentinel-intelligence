"use client";

import { useTranslations } from "next-intl";
import { SettingsAIForm } from "@/components/admin/settings-ai-form";
import { SettingsNotificationsForm } from "@/components/admin/settings-notifications-form";
import { SettingsGeneralForm } from "@/components/admin/settings-general-form";

export default function AdminSettingsPage() {
  const t = useTranslations("admin.settings");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <SettingsGeneralForm />
        <SettingsAIForm />
        <SettingsNotificationsForm />
      </div>
    </div>
  );
}
