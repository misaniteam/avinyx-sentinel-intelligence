'use client';

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useCreateDataSource, useUpdateDataSource } from "@/lib/api/hooks";
import type { DataSource } from "@/types";

const PLATFORMS = [
  { value: "brand24", label: "Brand24" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "news_rss", label: "News RSS" },
  { value: "news_api", label: "News API" },
  { value: "reddit", label: "Reddit" },
] as const;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
] as const;

type Platform = typeof PLATFORMS[number]["value"];

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
});

const youtubeConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  channel_ids: z.string().optional(),
  search_queries: z.string().optional(),
});

const twitterConfigSchema = z.object({
  api_key: z.string().min(1, "API key is required"),
  api_secret: z.string().min(1, "API secret is required"),
  bearer_token: z.string().min(1, "Bearer token is required"),
  search_queries: z.string().optional(),
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

type FormData = z.infer<typeof baseSchema> & Record<string, string | boolean | number>;

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
      if (field.type === "textarea" && typeof val === "string") {
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
  type: "password" | "text" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

function getConfigFieldsForPlatform(platform: string): ConfigField[] {
  switch (platform) {
    case "brand24":
      return [
        { name: "api_key", label: "API Key", type: "password", required: true },
        { name: "project_id", label: "Project ID", type: "text", required: true },
      ];
    case "youtube":
      return [
        { name: "api_key", label: "API Key", type: "password", required: true },
        { name: "channel_ids", label: "Channel IDs", type: "textarea", placeholder: "Comma-separated channel IDs" },
        { name: "search_queries", label: "Search Queries", type: "textarea", placeholder: "Comma-separated search queries" },
      ];
    case "twitter":
      return [
        { name: "api_key", label: "API Key", type: "password", required: true },
        { name: "api_secret", label: "API Secret", type: "password", required: true },
        { name: "bearer_token", label: "Bearer Token", type: "password", required: true },
        { name: "search_queries", label: "Search Queries", type: "textarea", placeholder: "Comma-separated search queries" },
      ];
    case "news_rss":
      return [
        { name: "feed_urls", label: "Feed URLs", type: "textarea", placeholder: "One URL per line", required: true },
      ];
    case "news_api":
      return [
        { name: "api_key", label: "API Key", type: "password", required: true },
        { name: "keywords", label: "Keywords", type: "textarea", placeholder: "Comma-separated keywords" },
        { name: "sources", label: "Sources", type: "text", placeholder: "Comma-separated source IDs" },
        { name: "language", label: "Language", type: "select", options: [...LANGUAGES] },
      ];
    case "reddit":
      return [
        { name: "client_id", label: "Client ID", type: "password", required: true },
        { name: "client_secret", label: "Client Secret", type: "password", required: true },
        { name: "subreddits", label: "Subreddits", type: "textarea", placeholder: "Comma-separated subreddit names" },
      ];
    default:
      return [];
  }
}

function extractConfigValues(config: Record<string, unknown>, platform: string): Record<string, string> {
  const values: Record<string, string> = {};
  const fields = getConfigFieldsForPlatform(platform);
  for (const field of fields) {
    const val = config[field.name];
    if (val === undefined || val === null) {
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
  const createDataSource = useCreateDataSource();
  const updateDataSource = useUpdateDataSource();

  const isCreate = mode === "create";

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
        toast.error(firstError?.message || "Invalid configuration");
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
        toast.success("Data source created successfully");
      } else if (dataSource) {
        await updateDataSource.mutateAsync({
          id: dataSource.id,
          name: data.name,
          config: Object.keys(config).length > 0 ? config : undefined,
          poll_interval_minutes: data.poll_interval_minutes,
          is_active: data.is_active,
        });
        toast.success("Data source updated successfully");
      }
      onOpenChange(false);
    } catch (error: unknown) {
      const detail = (error as { response?: { status?: number } })?.response?.status;
      if (detail === 409) {
        toast.error("A data source with this name already exists");
      } else {
        toast.error(isCreate ? "Failed to create data source" : "Failed to update data source");
      }
    }
  }

  const isPending = createDataSource.isPending || updateDataSource.isPending;
  const configFields = getConfigFieldsForPlatform(watchedPlatform);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add Data Source" : "Edit Data Source"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Configure a new platform connector to ingest data."
              : "Update the data source settings and credentials."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* General Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">General</h4>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...form.register("name", { required: "Name is required" })} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Controller
                control={form.control}
                name="platform"
                rules={{ required: "Platform is required" }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!isCreate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
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
              <Label htmlFor="poll_interval_minutes">Poll Interval (minutes)</Label>
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
                <Label htmlFor="is_active">Active</Label>
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
          {watchedPlatform && configFields.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">Credentials</h4>
                {configFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    {field.type === "password" && (
                      <Input
                        id={field.name}
                        type="password"
                        placeholder={!isCreate && isMasked(form.getValues(field.name as keyof FormData)) ? "Leave blank to keep current value" : undefined}
                        {...form.register(field.name as keyof FormData)}
                        onChange={(e) => {
                          form.setValue(field.name as keyof FormData, e.target.value);
                        }}
                      />
                    )}
                    {field.type === "text" && (
                      <Input
                        id={field.name}
                        placeholder={field.placeholder}
                        {...form.register(field.name as keyof FormData)}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        id={field.name}
                        rows={3}
                        placeholder={field.placeholder}
                        {...form.register(field.name as keyof FormData)}
                      />
                    )}
                    {field.type === "select" && field.options && (
                      <Controller
                        control={form.control}
                        name={field.name as keyof FormData}
                        render={({ field: controllerField }) => (
                          <Select
                            value={String(controllerField.value || "")}
                            onValueChange={controllerField.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options!.map((opt) => (
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
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isCreate
                  ? "Creating..."
                  : "Saving..."
                : isCreate
                  ? "Add Data Source"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
