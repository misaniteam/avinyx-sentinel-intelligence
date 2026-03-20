"use client";

import { useReports } from "@/lib/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";

export default function ReportsPage() {
  const { data: reports, isLoading } = useReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> Generate Report</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">Name</th>
                <th className="p-3 text-left font-medium">Format</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports?.map((report) => (
                <tr key={report.id} className="border-b">
                  <td className="p-3">{report.name}</td>
                  <td className="p-3 uppercase">{report.format}</td>
                  <td className="p-3">{report.status}</td>
                  <td className="p-3">
                    {report.generated_file && (
                      <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                    )}
                  </td>
                </tr>
              ))}
              {(!reports || reports.length === 0) && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No reports generated yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
