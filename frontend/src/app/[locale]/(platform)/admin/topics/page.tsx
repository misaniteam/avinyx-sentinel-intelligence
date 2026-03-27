"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useTopicKeywords, useDeleteTopicKeyword } from "@/lib/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Tags,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { TopicKeywordDialog } from "@/components/admin/topic-keyword-dialog";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import type { TopicKeyword } from "@/types";

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  negative: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

export default function AdminTopicsPage() {
  const t = useTranslations("admin.topics");
  const tc = useTranslations("common");

  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedTopic, setSelectedTopic] = useState<TopicKeyword | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<TopicKeyword | null>(null);

  const { data: topics, isLoading } = useTopicKeywords();
  const deleteMutation = useDeleteTopicKeyword();

  const filteredTopics = useMemo(() => {
    if (!topics) return [];
    return topics.filter((topic) => {
      if (searchQuery && !topic.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (sentimentFilter && topic.sentiment_direction !== sentimentFilter) {
        return false;
      }
      return true;
    });
  }, [topics, searchQuery, sentimentFilter]);

  const hasFilters = searchQuery || sentimentFilter;

  function handleCreate() {
    setSelectedTopic(null);
    setDialogMode("create");
    setDialogOpen(true);
  }

  function handleEdit(topic: TopicKeyword) {
    setSelectedTopic(topic);
    setDialogMode("edit");
    setDialogOpen(true);
  }

  function handleDeleteClick(topic: TopicKeyword) {
    setTopicToDelete(topic);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!topicToDelete) return;
    try {
      await deleteMutation.mutateAsync(topicToDelete.id);
      toast.success(t("topicDeleted"));
      setDeleteDialogOpen(false);
      setTopicToDelete(null);
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setSentimentFilter("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" /> {t("addTopic")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
        <Select
          value={sentimentFilter}
          onValueChange={setSentimentFilter}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t("allSentiments")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="positive">{t("positive")}</SelectItem>
            <SelectItem value="negative">{t("negative")}</SelectItem>
            <SelectItem value="neutral">{t("neutral")}</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" /> {tc("clear")}
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="rounded-md border">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Tags className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">
            {hasFilters ? t("noResultsFound") : t("noTopics")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? t("tryAdjustingFilters") : t("noTopicsDescription")}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">{t("name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("keywords")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("sentimentDirection")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("category")}</th>
                <th className="px-4 py-3 text-left font-medium">{tc("status")}</th>
                <th className="px-4 py-3 text-right font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTopics.map((topic) => (
                <tr
                  key={topic.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{topic.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {topic.keywords.slice(0, 5).map((kw, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                      {topic.keywords.length > 5 && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          +{topic.keywords.length - 5}
                        </Badge>
                      )}
                      {topic.keywords.length === 0 && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={SENTIMENT_COLORS[topic.sentiment_direction]}>
                      {t(topic.sentiment_direction)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {topic.category || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={topic.is_active ? "default" : "secondary"}>
                      {topic.is_active ? tc("active") : tc("inactive")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(topic)}>
                          <Pencil className="mr-2 h-4 w-4" /> {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteClick(topic)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TopicKeywordDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        topic={selectedTopic}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
