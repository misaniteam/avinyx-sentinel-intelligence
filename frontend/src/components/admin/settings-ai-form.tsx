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

const schema = z.object({
  provider: z.enum(["claude", "openai", "bedrock"]),
  model: z.string().min(1, "Model name is required"),
  api_key: z.string().optional(),
  fallback_provider: z.enum(["claude", "openai", "bedrock", "none"]).optional(),
});

type FormData = z.infer<typeof schema>;

export function SettingsAIForm() {
  const { data } = useTenantSettings();
  const updateSettings = useUpdateTenantSettings();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: "claude",
      model: "",
      api_key: "",
      fallback_provider: "none",
    },
  });

  const API_KEY_MASK = "••••••••";

  useEffect(() => {
    if (data?.settings?.ai) {
      const ai = data.settings.ai as Record<string, string>;
      form.reset({
        provider: (ai.provider as FormData["provider"]) || "claude",
        model: ai.model || "",
        api_key: "",
        fallback_provider: (ai.fallback_provider as FormData["fallback_provider"]) || "none",
      });
    }
  }, [data]);

  const hasExistingKey = !!(data?.settings?.ai as Record<string, string> | undefined)?.api_key;

  async function onSubmit(values: FormData) {
    try {
      const payload: Record<string, unknown> = { ...values };
      if (payload.fallback_provider === "none") {
        delete payload.fallback_provider;
      }
      // Only send api_key if user entered a new value
      if (!payload.api_key) {
        delete payload.api_key;
      }
      await updateSettings.mutateAsync({ settings: { ai: payload } });
      toast.success("AI provider settings saved");
    } catch {
      toast.error("Failed to save AI provider settings");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              value={form.watch("provider")}
              onValueChange={(v) => form.setValue("provider", v as FormData["provider"], { shouldDirty: true })}
            >
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="bedrock">AWS Bedrock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model">Model Name</Label>
            <Input
              id="ai-model"
              placeholder="e.g., claude-sonnet-4-5-20250514, gpt-4o"
              {...form.register("model")}
            />
            {form.formState.errors.model && (
              <p className="text-sm text-destructive">{form.formState.errors.model.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              placeholder={hasExistingKey ? API_KEY_MASK : "Enter API key"}
              {...form.register("api_key")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-fallback">Fallback Provider</Label>
            <Select
              value={form.watch("fallback_provider") || "none"}
              onValueChange={(v) => form.setValue("fallback_provider", v as FormData["fallback_provider"], { shouldDirty: true })}
            >
              <SelectTrigger id="ai-fallback">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="bedrock">AWS Bedrock</SelectItem>
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
