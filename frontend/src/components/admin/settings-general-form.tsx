'use client';

import { useEffect } from "react";
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

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
] as const;

const schema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  timezone: z.string().min(1, "Timezone is required"),
  default_language: z.string().min(1, "Language is required"),
});

type FormData = z.infer<typeof schema>;

export function SettingsGeneralForm() {
  const { data } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

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
      toast.success("General settings saved");
    } catch {
      toast.error("Failed to save general settings");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              placeholder="Organization display name"
              {...form.register("display_name")}
            />
            {form.formState.errors.display_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={form.watch("timezone")}
              onValueChange={(v) => form.setValue("timezone", v, { shouldDirty: true })}
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
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
            <Label htmlFor="language">Default Language</Label>
            <Select
              value={form.watch("default_language")}
              onValueChange={(v) => form.setValue("default_language", v, { shouldDirty: true })}
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
