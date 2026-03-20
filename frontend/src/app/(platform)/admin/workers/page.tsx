"use client";

import { useWorkerStatus } from "@/lib/firebase/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminWorkersPage() {
  const { workers, isLoading } = useWorkerStatus();
  const workerList = Object.entries(workers);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "running":
        return "default" as const;
      case "completed":
        return "secondary" as const;
      case "failed":
        return "destructive" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Worker Status</h1>
        <Badge variant="outline" className="text-sm">
          {workerList.length} worker{workerList.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse bg-muted rounded-lg" />
          ))}
        </div>
      ) : workerList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No active workers</p>
            <p className="text-sm text-muted-foreground mt-1">
              Worker status will appear here when ingestion jobs run
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workerList.map(([id, worker]) => (
            <Card key={id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium capitalize">
                  {worker.platform}
                </CardTitle>
                <Badge variant={getStatusVariant(worker.status)}>
                  {getStatusIcon(worker.status)}
                  <span className="ml-1">{worker.status}</span>
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items fetched</span>
                    <span className="font-medium">
                      {worker.items_fetched ?? 0}
                    </span>
                  </div>
                  {worker.started_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span>
                        {formatDistanceToNow(new Date(worker.started_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                  {worker.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last update</span>
                      <span>
                        {formatDistanceToNow(new Date(worker.updated_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  )}
                  {worker.error && (
                    <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                      {worker.error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
