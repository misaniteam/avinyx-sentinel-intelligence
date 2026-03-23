'use client';

import { useEffect, useMemo, useState, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileUp, X, FileText, FileSpreadsheet } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TagInput } from "@/components/ui/tag-input";
import { useCreateDataSource, useUpdateDataSource, useUploadFileDataSource } from "@/lib/api/hooks";
import type { DataSource } from "@/types";

const PLATFORM_VALUES = ["brand24", "youtube", "twitter", "news_rss", "news_api", "reddit", "file_upload"] as const;

const LANGUAGE_VALUES = ["en", "es", "fr", "de", "hi", "pt", "ar", "zh", "ja"] as const;

type Platform = typeof PLATFORM_VALUES[number];

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const ACCEPTED_FILE_EXTENSIONS = ".pdf,.xlsx,.xls";
const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(size < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return FileText;
  return FileSpreadsheet;
}

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
  const uploadFileDataSource = useUploadFileDataSource();

  const isCreate = mode === "create";
  const isFileUpload = dataSource?.platform === "file_upload";

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSelectedFiles([]);
      setFileErrors([]);
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
      setSelectedFiles([]);
      setFileErrors([]);
    }
  }, [open, mode, dataSource]);

  function validateFiles(files: File[]): string[] {
    const errors: string[] = [];
    if (files.length > MAX_FILES) {
      errors.push(t("fileUpload.maxFilesError", { max: MAX_FILES }));
    }
    for (const file of files) {
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        errors.push(t("fileUpload.invalidTypeError", { name: file.name }));
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(t("fileUpload.fileTooLargeError", { name: file.name, max: "50 MB" }));
      }
    }
    return errors;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const combined = [...selectedFiles, ...newFiles];
    const errors = validateFiles(combined);
    setFileErrors(errors);

    if (errors.length === 0) {
      setSelectedFiles(combined);
    }
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveFile(index: number) {
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    setFileErrors(validateFiles(updated));
  }

  async function onSubmit(data: FormData) {
    const platform = data.platform;

    // Handle file_upload platform separately
    if (platform === "file_upload") {
      if (selectedFiles.length === 0) {
        toast.error(t("fileUpload.noFilesError"));
        return;
      }
      const errors = validateFiles(selectedFiles);
      if (errors.length > 0) {
        toast.error(errors[0]);
        return;
      }

      const formData = new FormData();
      formData.append("name", data.name);
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      try {
        await uploadFileDataSource.mutateAsync(formData);
        toast.success(t("createSuccess"));
        onOpenChange(false);
      } catch {
        toast.error(t("createFailed"));
      }
      return;
    }

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

  const isPending = createDataSource.isPending || updateDataSource.isPending || uploadFileDataSource.isPending;
  const configFieldDefs = getConfigFieldDefsForPlatform(watchedPlatform);
  const isFileUploadPlatform = watchedPlatform === "file_upload";

  // For edit mode on file_upload, extract stored file info from config
  const existingFiles = useMemo(() => {
    if (!dataSource || dataSource.platform !== "file_upload") return [];
    const files = dataSource.config?.files;
    if (!Array.isArray(files)) return [];
    return files as Array<{ filename: string; s3_key: string; content_type: string; size: number }>;
  }, [dataSource]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? t("addDataSource") : t("editDataSource")}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? isFileUploadPlatform
                ? t("fileUpload.createDescription")
                : t("createDescription")
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

            {/* Hide poll interval for file_upload */}
            {!isFileUploadPlatform && (
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
            )}

            {/* Hide active toggle for file_upload */}
            {!isCreate && !isFileUpload && (
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

          {/* File Upload Section (create mode) */}
          {isFileUploadPlatform && isCreate && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">{t("fileUpload.sectionTitle")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("fileUpload.description")}
                </p>

                <div className="space-y-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm font-medium">{t("fileUpload.dropzoneLabel")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("fileUpload.acceptedFormats")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("fileUpload.limits", { maxFiles: MAX_FILES, maxSize: "50 MB" })}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_FILE_EXTENSIONS}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>

                  {/* File error messages */}
                  {fileErrors.length > 0 && (
                    <div className="space-y-1">
                      {fileErrors.map((error, i) => (
                        <p key={i} className="text-sm text-destructive">{error}</p>
                      ))}
                    </div>
                  )}

                  {/* Selected files list */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t("fileUpload.selectedFiles", { count: selectedFiles.length })}</Label>
                      <div className="rounded-md border divide-y">
                        {selectedFiles.map((file, index) => {
                          const Icon = getFileIcon(file.name);
                          return (
                            <div key={`${file.name}-${index}`} className="flex items-center gap-3 px-3 py-2">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate flex-1">{file.name}</span>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {formatFileSize(file.size)}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleRemoveFile(index)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* File Upload Section (edit mode - read only) */}
          {isFileUpload && !isCreate && existingFiles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">{t("fileUpload.uploadedFiles")}</h4>
                <div className="rounded-md border divide-y">
                  {existingFiles.map((file, index) => {
                    const Icon = getFileIcon(file.filename);
                    return (
                      <div key={`${file.s3_key}-${index}`} className="flex items-center gap-3 px-3 py-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate flex-1">{file.filename}</span>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {formatFileSize(file.size)}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Credentials Section (non-file-upload platforms only) */}
          {watchedPlatform && !isFileUploadPlatform && configFieldDefs.length > 0 && (
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
                  ? isFileUploadPlatform ? t("fileUpload.uploading") : tc("creating")
                  : tc("saving")
                : isCreate
                  ? isFileUploadPlatform ? t("fileUpload.uploadButton") : t("addDataSource")
                  : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
