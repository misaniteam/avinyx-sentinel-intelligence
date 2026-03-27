"use client";

import { useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { useCreateTopicKeyword, useUpdateTopicKeyword } from "@/lib/api/hooks";
import type { TopicKeyword } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  keywords: z.array(z.string()).default([]),
  sentiment_direction: z.enum(["positive", "negative", "neutral"]),
  category: z.string().max(100).optional().nullable(),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

interface TopicKeywordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  topic?: TopicKeyword | null;
}

export function TopicKeywordDialog({
  open,
  onOpenChange,
  mode,
  topic,
}: TopicKeywordDialogProps) {
  const t = useTranslations("admin.topics");
  const tc = useTranslations("common");

  const createMutation = useCreateTopicKeyword();
  const updateMutation = useUpdateTopicKeyword();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      keywords: [],
      sentiment_direction: "neutral",
      category: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === "edit" && topic) {
        reset({
          name: topic.name,
          keywords: topic.keywords,
          sentiment_direction: topic.sentiment_direction,
          category: topic.category || "",
          is_active: topic.is_active,
        });
      } else {
        reset({
          name: "",
          keywords: [],
          sentiment_direction: "neutral",
          category: "",
          is_active: true,
        });
      }
    }
  }, [open, mode, topic, reset]);

  async function onSubmit(values: FormValues) {
    const data = {
      ...values,
      category: values.category || null,
    };

    try {
      if (mode === "edit" && topic) {
        await updateMutation.mutateAsync({ id: topic.id, ...data });
        toast.success(t("topicUpdated"));
      } else {
        await createMutation.mutateAsync(data);
        toast.success(t("topicCreated"));
      }
      onOpenChange(false);
    } catch {
      toast.error(mode === "edit" ? t("updateFailed") : t("createFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? t("editTopic") : t("addTopic")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={t("namePlaceholder")}
              disabled={isPending}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("keywords")}</Label>
            <Controller
              name="keywords"
              control={control}
              render={({ field }) => (
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("keywordsPlaceholder")}
                  disabled={isPending}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("sentimentDirection")}</Label>
            <Controller
              name="sentiment_direction"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">{t("positive")}</SelectItem>
                    <SelectItem value="negative">{t("negative")}</SelectItem>
                    <SelectItem value="neutral">{t("neutral")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t("category")}</Label>
            <Input
              id="category"
              {...register("category")}
              placeholder={t("categoryPlaceholder")}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">{tc("active")}</Label>
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  id="is_active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </div>

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
                ? tc("saving")
                : mode === "edit"
                  ? tc("save")
                  : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
