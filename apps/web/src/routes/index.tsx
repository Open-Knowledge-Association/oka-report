import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Activity,
} from "lucide-react";
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

  const formatSigned = (value: number | null | undefined) => {
    const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
    if (safeValue === 0) return "0";
    return `${safeValue > 0 ? "+" : ""}${safeValue.toLocaleString()}`;
  };

  const getDeltaToneClass = (
    delta: number | null | undefined,
    externalValue: number | null | undefined,
  ) => {
    const safeDelta = typeof delta === "number" && Number.isFinite(delta) ? delta : 0;
    const safeExternal =
      typeof externalValue === "number" && Number.isFinite(externalValue) ? externalValue : 0;

    const abs = Math.abs(safeDelta);
    if (abs === 0) {
      return "border-emerald-200 bg-emerald-50";
    }

    const ratio = safeExternal === 0 ? abs : abs / Math.max(1, safeExternal);
    if (ratio <= 0.01 || abs <= 5) {
      return "border-amber-200 bg-amber-50";
    }

    return "border-rose-200 bg-rose-50";
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of OKA Wikipedia contributions</p>
        </div>

        {isLoadingStats ? (
          <div className="rounded-lg border border-slate-200 bg-white py-10 text-center text-sm text-slate-500">
            Loading statistics...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 py-10 text-center text-sm text-red-600">
            Error loading statistics: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        ) : (
          <>
            <div>
              <OutreachStats stats={dashboardStats} />
            </div>

            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900">Data Sync Status</CardTitle>
                      <CardDescription>
                        Comparing local database with Outreach Dashboard
                      </CardDescription>
                    </div>
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                          Local Editors
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {syncStatus.local.editorsCount}
                        </p>
                        {syncStatus.external && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-500">External:</span>
                            <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                              {syncStatus.external.editorsCount}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                          Local Articles
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {syncStatus.local.articlesCount}
                        </p>
                        {syncStatus.external && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-500">External:</span>
                            <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">
                              {syncStatus.external.articlesCount}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                          Last Sync
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {formatTimeAgo(syncStatus.lastSync?.completedAt)}
                        </p>
                        {syncStatus.lastSync && (
                          <div className="mt-1">
                            <Badge variant="outline" className="font-normal text-xs text-slate-500">
                              {syncStatus.lastSync.jobType}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                          Active Jobs
                        </p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">
                          {syncStatus.jobs.active.length}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {syncStatus.syncHealth.staleHours == null
                            ? "No completed sync"
                            : `${syncStatus.syncHealth.staleHours}h since last complete`}
                        </p>
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

                    {syncStatus.external && syncStatus.deltas && (
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            Drift vs Outreach (Local - External)
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded bg-emerald-200" /> Match
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded bg-amber-200" /> Small
                              drift
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded bg-rose-200" /> Large
                              drift
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Drift uses precise external totals aggregated from Outreach article list
                          (not compact course counters like 2.32B / 74.4M).
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Upload drift compares external participants only, to avoid counting
                          local-only editors.
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Upload metrics are not fully apple-to-apple between Outreach and Commons
                          raw history, so treat this delta as informational.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div
                            className={`rounded border p-2 ${getDeltaToneClass(syncStatus.deltas.editors, syncStatus.external.editorsCount)}`}
                          >
                            <p className="text-muted-foreground">Editors</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.editors)}
                            </p>
                          </div>
                          <div
                            className={`rounded border p-2 ${getDeltaToneClass(syncStatus.deltas.articles, syncStatus.external.articlesCount)}`}
                          >
                            <p className="text-muted-foreground">Articles</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.articles)}
                            </p>
                          </div>
                          <div
                            className={`rounded border p-2 ${getDeltaToneClass(syncStatus.deltas.wordsAdded, syncStatus.external.wordsAdded)}`}
                          >
                            <p className="text-muted-foreground">Words</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.wordsAdded)}
                            </p>
                          </div>
                          <div
                            className={`rounded border p-2 ${getDeltaToneClass(syncStatus.deltas.pageviews, syncStatus.external.pageviews)}`}
                          >
                            <p className="text-muted-foreground">Views</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.pageviews)}
                            </p>
                          </div>
                          <div
                            className={`rounded border p-2 ${getDeltaToneClass(syncStatus.deltas.referencesAdded, syncStatus.external.referencesAdded)}`}
                          >
                            <p className="text-muted-foreground">Refs</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.referencesAdded)}
                            </p>
                          </div>
                          <div className="rounded border border-slate-300 border-dashed p-2 bg-slate-50">
                            <p className="text-muted-foreground">Uploads</p>
                            <p className="font-semibold">
                              {formatSigned(syncStatus.deltas.commonsUploads)}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Informational only
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t space-y-2">
                      <p className="text-sm font-medium">Latest Job per Type</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {syncStatus.jobs.latestByType.map((job) => (
                          <div key={job.jobType} className="rounded border border-slate-200 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{job.jobType}</span>
                              <Badge variant={job.status === "completed" ? "default" : "secondary"}>
                                {job.status}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1">
                              {job.completedAt
                                ? `Completed ${formatTimeAgo(job.completedAt)}`
                                : `Created ${formatTimeAgo(job.createdAt)}`}
                            </p>
                            {job.error ? (
                              <p className="text-red-600 mt-1 truncate">{job.error}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {syncStatus.syncHealth.latestFailedJobs.length > 0 ? (
                      <div className="pt-3 border-t">
                        <p className="text-xs text-red-600">
                          Latest failed jobs: {syncStatus.syncHealth.latestFailedJobs.join(", ")}
                        </p>
                      </div>
                    ) : null}

                    <div className="pt-3 border-t space-y-2">
                      <p className="text-sm font-medium">Raw Verification Data</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="rounded border border-slate-200 p-2">
                          <p className="font-medium mb-1">Local (parsed)</p>
                          <p>Editors: {syncStatus.raw.local.editorsCount.toLocaleString()}</p>
                          <p>Articles: {syncStatus.raw.local.articlesCount.toLocaleString()}</p>
                          <p>Words: {syncStatus.raw.local.wordsAdded.toLocaleString()}</p>
                          <p>Views: {syncStatus.raw.local.pageviews.toLocaleString()}</p>
                          <p>Refs: {syncStatus.raw.local.referencesAdded.toLocaleString()}</p>
                          <p>Uploads: {syncStatus.raw.local.commonsUploads.toLocaleString()}</p>
                          <p>
                            Uploads (comparable):{" "}
                            {(
                              syncStatus.raw.local.commonsUploadsComparable ??
                              syncStatus.raw.local.commonsUploads
                            ).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 p-2">
                          <p className="font-medium mb-1">External (raw from Outreach)</p>
                          {syncStatus.raw.external ? (
                            <>
                              <p>Editors: {String(syncStatus.raw.external.student_count)}</p>
                              <p>Articles: {String(syncStatus.raw.external.article_count)}</p>
                              <p>Words: {String(syncStatus.raw.external.word_count)}</p>
                              <p>Views: {String(syncStatus.raw.external.view_count)}</p>
                              <p>Refs: {String(syncStatus.raw.external.references_count)}</p>
                              <p>Uploads: {String(syncStatus.raw.external.upload_count)}</p>
                              {syncStatus.raw.external.precise_from_articles &&
                              typeof syncStatus.raw.external.precise_from_articles === "object" ? (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <p className="font-medium mb-1">
                                    External (precise from article list)
                                  </p>
                                  <p>
                                    Editors:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).editorsCount,
                                    )}
                                  </p>
                                  <p>
                                    Articles:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).articlesCount,
                                    )}
                                  </p>
                                  <p>
                                    Words:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).wordsAdded,
                                    )}
                                  </p>
                                  <p>
                                    Views:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).pageviews,
                                    )}
                                  </p>
                                  <p>
                                    Refs:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).referencesAdded,
                                    )}
                                  </p>
                                  <p>
                                    Uploads:{" "}
                                    {String(
                                      (
                                        syncStatus.raw.external.precise_from_articles as Record<
                                          string,
                                          unknown
                                        >
                                      ).commonsUploads,
                                    )}
                                  </p>
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-muted-foreground">External data unavailable</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <a
                          href={syncStatus.sources.localSyncStatusApi}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary underline"
                        >
                          Open Local Sync Status JSON
                        </a>
                        <a
                          href={syncStatus.sources.outreachCourseApi}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary underline"
                        >
                          Open Outreach Course JSON
                        </a>
                      </div>
                    </div>

                    {syncStatus.external && (
                      <div className="pt-2 border-t">
                        <a
                          href={syncStatus.sources.outreachCoursePage}
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
                    <a href="/admin/sync-jobs">
                      Sync Job Manager
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-between">
                    <a href="/admin/schedule-manager">
                      Schedule Manager
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
    </>
  );
}
