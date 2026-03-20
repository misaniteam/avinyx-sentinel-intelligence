"use client";

import { useState } from "react";
import { useReports } from "@/lib/api/hooks";
import { useCreateReport, useGenerateReport, useReportDownloadUrl } from "@/lib/api/hooks-analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Download, Play, Loader2 } from "lucide-react";

const FORMAT_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Image" },
  { value: "csv", label: "CSV" },
];

export default function ReportsPage() {
  const { data: reports, isLoading } = useReports();
  const createReport = useCreateReport();
  const generateReport = useGenerateReport();
  const downloadReport = useReportDownloadUrl();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("pdf");

  function handleCreate() {
    if (!name.trim()) return;
    createReport.mutate(
      { name: name.trim(), format },
      {
        onSuccess: () => {
          setName("");
          setFormat("pdf");
          setDialogOpen(false);
        },
      }
    );
  }

  function handleGenerate(reportId: string) {
    generateReport.mutate(reportId);
  }

  function handleDownload(reportId: string) {
    downloadReport.mutate(reportId, {
      onSuccess: (data) => {
        const link = document.createElement("a");
        link.href = data.download_url;
        link.rel = "noopener noreferrer";
        link.click();
      },
    });
  }

  function statusBadgeClass(status: string) {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "generating":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Reports</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="report-name">Name</Label>
                <Input
                  id="report-name"
                  placeholder="Monthly Sentiment Summary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-format">Format</Label>
                <select
                  id="report-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!name.trim() || createReport.isPending}
              >
                {createReport.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
              {isLoading && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {reports?.map((report) => (
                <tr key={report.id} className="border-b">
                  <td className="p-3">{report.name}</td>
                  <td className="p-3 uppercase">{report.format}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(report.status)}`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      {report.status !== "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerate(report.id)}
                          disabled={
                            generateReport.isPending &&
                            generateReport.variables === report.id
                          }
                          title="Generate report"
                        >
                          {generateReport.isPending &&
                          generateReport.variables === report.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {report.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(report.id)}
                          disabled={
                            downloadReport.isPending &&
                            downloadReport.variables === report.id
                          }
                          title="Download report"
                        >
                          {downloadReport.isPending &&
                          downloadReport.variables === report.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && (!reports || reports.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-muted-foreground"
                  >
                    No reports generated yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
