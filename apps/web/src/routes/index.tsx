import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OutreachStats } from "@/components/outreach";
import { fetchDashboardStats, fetchSyncStatus } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const {
    data: dashboardStats,
    isLoading: isLoadingStats,
    error,
  } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: fetchDashboardStats,
  });

  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useQuery({
    queryKey: ["stats", "sync-status"],
    queryFn: fetchSyncStatus,
    refetchInterval: 30000,
  });

  const formatTimeAgo = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return "Just now";
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of OKA Wikipedia contributions</p>
      </div>

      {isLoadingStats ? (
        <div className="text-center py-12">Loading statistics...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">
          Error loading statistics: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : (
        <>
          <div className="mb-8">
            <OutreachStats stats={dashboardStats} />
          </div>

          <Card className="mb-8">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Data Sync Status</CardTitle>
                  <CardDescription>
                    Comparing local database with Outreach Dashboard
                  </CardDescription>
                </div>
                {!isLoadingSyncStatus && syncStatus && (
                  <div className="flex items-center gap-2">
                    {syncStatus.syncRequired ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Sync Required
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 bg-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        In Sync
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingSyncStatus ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking sync status...
                </div>
              ) : syncStatus ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Local Editors</p>
                      <p className="text-xl font-semibold">{syncStatus.local.editorsCount}</p>
                      {syncStatus.external && (
                        <p className="text-xs text-muted-foreground">
                          External: {syncStatus.external.editorsCount}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Local Articles</p>
                      <p className="text-xl font-semibold">{syncStatus.local.articlesCount}</p>
                      {syncStatus.external && (
                        <p className="text-xs text-muted-foreground">
                          External: {syncStatus.external.articlesCount}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Sync</p>
                      <p className="text-xl font-semibold">
                        {formatTimeAgo(syncStatus.lastSync?.completedAt)}
                      </p>
                      {syncStatus.lastSync && (
                        <p className="text-xs text-muted-foreground">
                          Type: {syncStatus.lastSync.jobType}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button
                        asChild
                        size="sm"
                        variant={syncStatus.syncRequired ? "default" : "outline"}
                      >
                        <a href="/admin/sync-jobs">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {syncStatus.syncRequired ? "Run Sync" : "Manage Sync"}
                        </a>
                      </Button>
                    </div>
                  </div>
                  {syncStatus.external && (
                    <div className="pt-2 border-t">
                      <a
                        href="https://outreachdashboard.wmflabs.org/courses/OKA/OKA/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        View on Outreach Dashboard
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to fetch sync status</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button asChild className="w-full justify-between">
                  <a href="/admin/editors">
                    Manage Editors
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href="/admin/editors/new">
                    Add New Editor
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <a href="/editors">
                    View Editor Stats
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>About OKA Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">
                  This platform tracks Wikipedia editing contributions from OKA (Open Knowledge
                  Association) members and grant recipients.
                </p>
                <p className="text-sm text-slate-600">
                  Metrics include edits, words added, pageviews, articles created, and Wikimedia
                  Commons uploads.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
