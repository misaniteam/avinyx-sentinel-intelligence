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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTenantSettings, useUpdateTenantSettings } from "@/lib/api/hooks";

const TIMEZONES = [
  "UTC",
  "US/Eastern",
  "US/Central",
  "US/Mountain",
  "US/Pacific",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

const LANGUAGE_KEYS = ["en", "hi", "es", "fr", "de", "ja", "pt"] as const;

type FormData = {
  display_name: string;
  timezone: string;
  default_language: string;
};

export function SettingsGeneralForm() {
  const t = useTranslations("admin.settings.general");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const { data } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const schema = z.object({
    display_name: z.string().min(1, tv("displayNameRequired")),
    timezone: z.string().min(1, tv("timezoneRequired")),
    default_language: z.string().min(1, tv("languageRequired")),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: "",
      timezone: "UTC",
      default_language: "en",
    },
  });

  useEffect(() => {
    if (data?.settings?.general) {
      const g = data.settings.general as Record<string, string>;
      form.reset({
        display_name: g.display_name || "",
        timezone: g.timezone || "UTC",
        default_language: g.default_language || "en",
      });
    }
  }, [data]);

  async function onSubmit(values: FormData) {
    try {
      await updateSettings.mutateAsync({ settings: { general: values } });
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
            <Label htmlFor="display-name">{t("displayName")}</Label>
            <Input
              id="display-name"
              placeholder={t("displayNamePlaceholder")}
              {...form.register("display_name")}
            />
            {form.formState.errors.display_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <Select
              value={form.watch("timezone")}
              onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder={t("selectTimezone")} />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t("defaultLanguage")}</Label>
            <Select
              value={form.watch("default_language")}
              onValueChange={(v) => form.setValue("default_language", v, { shouldDirty: true })}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder={t("selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`languages.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? tc("saving") : tc("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
