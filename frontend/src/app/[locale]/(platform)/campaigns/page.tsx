"use client";

import { useCampaigns } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const { data: campaigns, isLoading } = useCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button><Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("newCampaign")}</Button>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns?.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader>
                <CardTitle className="text-lg">{campaign.name}</CardTitle>
                <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
                  campaign.status === "active" ? "bg-green-100 text-green-800" :
                  campaign.status === "draft" ? "bg-yellow-100 text-yellow-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {campaign.status}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">{campaign.description || "No description"}</p>
                {campaign.start_date && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(campaign.start_date), "MMM d, yyyy")}
                    {campaign.end_date && ` — ${format(new Date(campaign.end_date), "MMM d, yyyy")}`}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
          {(!campaigns || campaigns.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-12">{t("noCampaignsYet")}</p>
          )}
        </div>
      )}
    </div>
  );
}
