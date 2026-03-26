"use client";

import { useVoters } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export default function VotersPage() {
  const t = useTranslations("voters");
  const tc = useTranslations("common");
  const { data: voters, isLoading } = useVoters();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Button><Plus className="mr-1 h-4 w-4 text-theme-primary" /> {t("addVoter")}</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("voterDatabase")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">{tc("name")}</th>
                    <th className="p-3 text-left font-medium">{tc("region")}</th>
                    <th className="p-3 text-left font-medium">{t("sentiment")}</th>
                    <th className="p-3 text-left font-medium">{t("tags")}</th>
                  </tr>
                </thead>
                <tbody>
                  {voters?.map((voter) => (
                    <tr key={voter.id} className="border-b">
                      <td className="p-3">{voter.full_name}</td>
                      <td className="p-3">{voter.geo_region || "—"}</td>
                      <td className="p-3">{voter.sentiment_score?.toFixed(2) ?? "—"}</td>
                      <td className="p-3">{voter.tags.join(", ") || "—"}</td>
                    </tr>
                  ))}
                  {(!voters || voters.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("noVotersFound")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
