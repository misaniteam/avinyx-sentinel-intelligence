'use client';

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tag-input";
import { useCreateDataSource, useUpdateDataSource } from "@/lib/api/hooks";
import type { DataSource } from "@/types";

const PLATFORM_VALUES = ["brand24", "youtube", "twitter", "news_rss", "news_api", "reddit"] as const;

const LANGUAGE_VALUES = ["en", "es", "fr", "de", "hi", "pt", "ar", "zh", "ja"] as const;

type Platform = typeof PLATFORM_VALUES[number];

const baseSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  platform: z.string().min(1, "Platform is required"),
  poll_interval_minutes: z.coerce.number().min(1).max(1440),
  is_active: z.boolean(),
});

// Platform-specific config schemas
const brand24ConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  project_id: z.string().min(1, "Project ID is required"),
  search_queries: z.union([z.string(), z.array(z.string())]).optional(),
});

const youtubeConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  channel_ids: z.string().optional(),
  search_queries: z.union([z.string(), z.array(z.string())]).optional(),
});

const twitterConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  api_secret: z.string().min(1, "API secret is required"),
  bearer_token: z.string().min(1, "Bearer token is required"),
  search_queries: z.union([z.string(), z.array(z.string())]).optional(),
});

const newsRssConfigSchema = z.object({
  feed_urls: z.string().min(1, "At least one feed URL is required"),
});

const newsApiConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  keywords: z.string().optional(),
  sources: z.string().optional(),
  language: z.string().optional(),
});

const redditConfigSchema = z.object({
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client secret is required"),
  subreddits: z.string().optional(),
});

type FormData = z.infer<typeof baseSchema> & Record<string, string | boolean | number | string[]>;

function getConfigSchema(platform: string) {
  switch (platform) {
    case "brand24": return brand24ConfigSchema;
    case "youtube": return youtubeConfigSchema;
    case "twitter": return twitterConfigSchema;
    case "news_rss": return newsRssConfigSchema;
    case "news_api": return newsApiConfigSchema;
    case "reddit": return redditConfigSchema;
    default: return z.object({});
  }
}

const MASKED_VALUE = "****";

function isMasked(value: unknown): boolean {
  return value === MASKED_VALUE;
}

function buildConfigFromForm(platform: string, formData: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const fields = getConfigFieldsForPlatform(platform);
  for (const field of fields) {
    const val = formData[field.name];
    if (val !== undefined && val !== "" && !isMasked(val)) {
      if (field.type === "tags" && Array.isArray(val)) {
        if (val.length > 0) config[field.name] = val;
      } else if (field.type === "textarea" && typeof val === "string") {
        // Convert comma/newline-separated strings to arrays
        const separator = field.name === "feed_urls" ? "\n" : ",";
        config[field.name] = val.split(separator).map((s: string) => s.trim()).filter(Boolean);
      } else {
        config[field.name] = val;
      }
    }
  }
  return config;
}

interface ConfigField {
  name: string;
  label: string;
  type: "password" | "text" | "textarea" | "select" | "tags";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface ConfigFieldDef {
  name: string;
  labelKey: string;
  type: "password" | "text" | "textarea" | "select" | "tags";
  placeholderKey?: string;
  required?: boolean;
  hasLanguageOptions?: boolean;
}

const PLATFORM_CONFIG_FIELDS: Record<string, ConfigFieldDef[]> = {
  brand24: [
    { name: "api_key", labelKey: "fields.apiKey", type: "password", required: true },
    { name: "project_id", labelKey: "fields.projectId", type: "text", required: true },
    { name: "search_queries", labelKey: "fields.hashtagsTopics", type: "tags", placeholderKey: "placeholders.hashtagsTopics" },
  ],
  youtube: [
    { name: "api_key", labelKey: "fields.apiKey", type: "password", required: true },
    { name: "channel_ids", labelKey: "fields.channelIds", type: "textarea", placeholderKey: "placeholders.channelIds" },
    { name: "search_queries", labelKey: "fields.hashtagsTopics", type: "tags", placeholderKey: "placeholders.hashtagsTopics" },
  ],
  twitter: [
    { name: "api_key", labelKey: "fields.apiKey", type: "password", required: true },
    { name: "api_secret", labelKey: "fields.apiSecret", type: "password", required: true },
    { name: "bearer_token", labelKey: "fields.bearerToken", type: "password", required: true },
    { name: "search_queries", labelKey: "fields.hashtagsTopics", type: "tags", placeholderKey: "placeholders.hashtagsTopics" },
  ],
  news_rss: [
    { name: "feed_urls", labelKey: "fields.feedUrls", type: "textarea", placeholderKey: "placeholders.feedUrls", required: true },
  ],
  news_api: [
    { name: "api_key", labelKey: "fields.apiKey", type: "password", required: true },
    { name: "keywords", labelKey: "fields.keywords", type: "textarea", placeholderKey: "placeholders.keywords" },
    { name: "sources", labelKey: "fields.sources", type: "text", placeholderKey: "placeholders.sources" },
    { name: "language", labelKey: "fields.language", type: "select", hasLanguageOptions: true },
  ],
  reddit: [
    { name: "client_id", labelKey: "fields.clientId", type: "password", required: true },
    { name: "client_secret", labelKey: "fields.clientSecret", type: "password", required: true },
    { name: "subreddits", labelKey: "fields.subreddits", type: "textarea", placeholderKey: "placeholders.subreddits" },
  ],
};

function getConfigFieldDefsForPlatform(platform: string): ConfigFieldDef[] {
  return PLATFORM_CONFIG_FIELDS[platform] || [];
}

function getConfigFieldsForPlatform(platform: string): ConfigField[] {
  // Legacy adapter used by buildConfigFromForm and extractConfigValues
  const defs = getConfigFieldDefsForPlatform(platform);
  return defs.map((d) => ({
    name: d.name,
    label: d.labelKey,
    type: d.type,
    placeholder: d.placeholderKey,
    required: d.required,
  }));
}

function extractConfigValues(config: Record<string, unknown>, platform: string): Record<string, string | string[]> {
  const values: Record<string, string | string[]> = {};
  const fields = getConfigFieldsForPlatform(platform);
  for (const field of fields) {
    const val = config[field.name];
    if (field.type === "tags") {
      values[field.name] = Array.isArray(val) ? val : [];
    } else if (val === undefined || val === null) {
      values[field.name] = "";
    } else if (Array.isArray(val)) {
      const separator = field.name === "feed_urls" ? "\n" : ", ";
      values[field.name] = val.join(separator);
    } else {
      values[field.name] = String(val);
    }
  }
  return values;
}

interface DataSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  dataSource?: DataSource;
}

export function DataSourceDialog({ open, onOpenChange, mode, dataSource }: DataSourceDialogProps) {
  const t = useTranslations("admin.dataSources");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");

  const createDataSource = useCreateDataSource();
  const updateDataSource = useUpdateDataSource();

  const isCreate = mode === "create";

  const platforms = useMemo(() =>
    PLATFORM_VALUES.map((value) => ({ value, label: t(`platforms.${value}`) })),
    [t]
  );

  const languages = useMemo(() =>
    LANGUAGE_VALUES.map((value) => ({ value, label: t(`languages.${value}`) })),
    [t]
  );

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      platform: "",
      poll_interval_minutes: 60,
      is_active: true,
    },
  });

  const watchedPlatform = form.watch("platform");

  useEffect(() => {
    if (open && isCreate) {
      form.reset({
        name: "",
        platform: "",
        poll_interval_minutes: 60,
        is_active: true,
      });
    }
    if (open && !isCreate && dataSource) {
      const configValues = extractConfigValues(dataSource.config, dataSource.platform);
      form.reset({
        name: dataSource.name,
        platform: dataSource.platform,
        poll_interval_minutes: dataSource.poll_interval_minutes,
        is_active: dataSource.is_active,
        ...configValues,
      });
    }
  }, [open, mode, dataSource]);

  async function onSubmit(data: FormData) {
    const platform = data.platform;

    // Validate platform-specific config
    const configSchema = getConfigSchema(platform);
    const configFields: Record<string, unknown> = {};
    const allFields = getConfigFieldsForPlatform(platform);
    for (const field of allFields) {
      configFields[field.name] = data[field.name as keyof FormData];
    }

    // For edit mode, skip validation of masked fields
    if (!isCreate) {
      for (const key of Object.keys(configFields)) {
        if (isMasked(configFields[key])) {
          delete configFields[key];
        }
      }
    }

    // Only validate non-masked fields in edit mode
    if (isCreate) {
      const configResult = configSchema.safeParse(configFields);
      if (!configResult.success) {
        const firstError = configResult.error.errors[0];
        toast.error(firstError?.message || tv("invalidConfiguration"));
        return;
      }
    }

    const config = buildConfigFromForm(platform, data);

    try {
      if (isCreate) {
        await createDataSource.mutateAsync({
          platform,
          name: data.name,
          config,
          poll_interval_minutes: data.poll_interval_minutes,
        });
        toast.success(t("createSuccess"));
      } else if (dataSource) {
        await updateDataSource.mutateAsync({
          id: dataSource.id,
          name: data.name,
          config: Object.keys(config).length > 0 ? config : undefined,
          poll_interval_minutes: data.poll_interval_minutes,
          is_active: data.is_active,
        });
        toast.success(t("updateSuccess"));
      }
      onOpenChange(false);
    } catch (error: unknown) {
      const detail = (error as { response?: { status?: number } })?.response?.status;
      if (detail === 409) {
        toast.error(t("duplicateNameError"));
      } else {
        toast.error(isCreate ? t("createFailed") : t("updateFailed"));
      }
    }
  }

  const isPending = createDataSource.isPending || updateDataSource.isPending;
  const configFieldDefs = getConfigFieldDefsForPlatform(watchedPlatform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? t("addDataSource") : t("editDataSource")}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? t("createDescription")
              : t("editDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* General Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">{t("general")}</h4>

            <div className="space-y-2">
              <Label htmlFor="name">{tc("name")}</Label>
              <Input id="name" {...form.register("name", { required: tv("nameRequired") })} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">{tc("platform")}</Label>
              <Controller
                control={form.control}
                name="platform"
                rules={{ required: tv("platformRequired") }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!isCreate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectPlatform")} />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.platform && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.platform.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll_interval_minutes">{t("pollIntervalMinutes")}</Label>
              <Input
                id="poll_interval_minutes"
                type="number"
                min={1}
                max={1440}
                {...form.register("poll_interval_minutes", { valueAsNumber: true })}
              />
              {form.formState.errors.poll_interval_minutes && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.poll_interval_minutes.message}
                </p>
              )}
            </div>

            {!isCreate && (
              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">{tc("active")}</Label>
                <Controller
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <Switch
                      id="is_active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
          </div>

          {/* Credentials Section */}
          {watchedPlatform && configFieldDefs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">{t("credentials")}</h4>
                {configFieldDefs.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {t(field.labelKey)}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === "password" && (
                      <Input
                        id={field.name}
                        type="password"
                        placeholder={!isCreate && isMasked(form.getValues(field.name as keyof FormData)) ? t("leaveBlankToKeep") : undefined}
                        {...form.register(field.name as keyof FormData)}
                        onChange={(e) => {
                          form.setValue(field.name as keyof FormData, e.target.value);
                        }}
                      />
                    )}
                    {field.type === "text" && (
                      <Input
                        id={field.name}
                        placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                        {...form.register(field.name as keyof FormData)}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        id={field.name}
                        rows={3}
                        placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                        {...form.register(field.name as keyof FormData)}
                      />
                    )}
                    {field.type === "tags" && (
                      <Controller
                        control={form.control}
                        name={field.name as keyof FormData}
                        render={({ field: controllerField }) => (
                          <TagInput
                            value={Array.isArray(controllerField.value) ? controllerField.value as string[] : []}
                            onChange={controllerField.onChange}
                            placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
                          />
                        )}
                      />
                    )}
                    {field.type === "select" && field.hasLanguageOptions && (
                      <Controller
                        control={form.control}
                        name={field.name as keyof FormData}
                        render={({ field: controllerField }) => (
                          <Select
                            value={String(controllerField.value || "")}
                            onValueChange={controllerField.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectOption")} />
                            </SelectTrigger>
                            <SelectContent>
                              {languages.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isCreate
                  ? tc("creating")
                  : tc("saving")
                : isCreate
                  ? t("addDataSource")
                  : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
