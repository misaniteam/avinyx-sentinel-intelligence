'use client';

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTenantSettings, useUpdateTenantSettings } from "@/lib/api/hooks";

const schema = z.object({
  sentiment_alert_threshold: z.coerce.number().min(-1).max(1),
  enable_email_alerts: z.boolean(),
  enable_push_notifications: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export function SettingsNotificationsForm() {
  const t = useTranslations("admin.settings.notifications");
  const tc = useTranslations("common");
  const { data } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sentiment_alert_threshold: -0.5,
      enable_email_alerts: false,
      enable_push_notifications: false,
    },
  });

  useEffect(() => {
    if (data?.settings?.notifications) {
      const n = data.settings.notifications as Record<string, unknown>;
      form.reset({
        sentiment_alert_threshold: typeof n.sentiment_alert_threshold === "number" ? n.sentiment_alert_threshold : -0.5,
        enable_email_alerts: !!n.enable_email_alerts,
        enable_push_notifications: !!n.enable_push_notifications,
      });
    }
  }, [data]);

  async function onSubmit(values: FormData) {
    try {
      await updateSettings.mutateAsync({ settings: { notifications: values } });
      toast.success(t("saved"));
    } catch {
      toast.error(t("failedSave"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sentiment-threshold">{t("sentimentThreshold")}</Label>
            <Input
              id="sentiment-threshold"
              type="number"
              step="0.1"
              min="-1"
              max="1"
              {...form.register("sentiment_alert_threshold")}
            />
            <p className="text-sm text-muted-foreground">
              {t("thresholdHelp")}
            </p>
            {form.formState.errors.sentiment_alert_threshold && (
              <p className="text-sm text-destructive">
                {form.formState.errors.sentiment_alert_threshold.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="email-alerts"
              checked={form.watch("enable_email_alerts")}
              onCheckedChange={(checked) =>
                form.setValue("enable_email_alerts", checked, { shouldDirty: true })
              }
            />
            <Label htmlFor="email-alerts">{t("emailAlerts")}</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="push-notifications"
              checked={form.watch("enable_push_notifications")}
              onCheckedChange={(checked) =>
                form.setValue("enable_push_notifications", checked, { shouldDirty: true })
              }
            />
            <Label htmlFor="push-notifications">{t("pushNotifications")}</Label>
          </div>

          <Button type="submit" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? tc("saving") : tc("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
