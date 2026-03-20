"use client";

import { useVoters } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function VotersPage() {
  const { data: voters, isLoading } = useVoters();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Voters</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> Add Voter</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Voter Database</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Region</th>
                    <th className="p-3 text-left font-medium">Sentiment</th>
                    <th className="p-3 text-left font-medium">Tags</th>
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
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No voters found</td></tr>
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
