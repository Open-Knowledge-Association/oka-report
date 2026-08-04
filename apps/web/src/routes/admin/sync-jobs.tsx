import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useSyncJobStream, type SyncJob } from "@/hooks/useSyncJobStream";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Square,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Info,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/sync-jobs")({
  component: SyncJobsPage,
});

function SyncJobsPage() {
  type LiveLogEntry = {
    at: string;
    message: string;
    level: "info" | "success" | "error";
  };

  const { jobs, isConnected, isLoading, error, reconnect } = useSyncJobStream();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [jobToCancel, setJobToCancel] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [triggeringSync, setTriggeringSync] = useState<string | null>(null);
  const [jobLogsById, setJobLogsById] = useState<Record<string, LiveLogEntry[]>>({});
  const triggerLockRef = useRef<string | null>(null);
  const previousJobsRef = useRef<
    Map<
      string,
      {
        status: SyncJob["status"];
        stage: string;
        processed: number;
        total: number;
      }
    >
  >(new Map());

  const handleCancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/sync/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      if (response.ok) {
        toast({
          title: "Job Cancelled",
          description: "The sync job has been cancelled.",
        });
      } else {
        throw new Error("Failed to cancel job");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to cancel job.",
        variant: "destructive",
      });
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/sync/jobs/${jobId}/retry`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Job Retried",
          description: `New job created with ID: ${data.data?.newJobId?.slice(0, 8)}...`,
        });
      } else {
        throw new Error("Failed to retry job");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to retry job.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/sync/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({
          title: "Job Deleted",
          description: "The sync job has been deleted.",
        });
      } else {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete job");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete job.",
        variant: "destructive",
      });
    }
  };

  const handleTriggerSync = async (jobType: string) => {
    if (triggeringSync || triggerLockRef.current) return;
    triggerLockRef.current = jobType;
    setTriggeringSync(jobType);

    try {
      let response;
      if (jobType === "outreach_articles") {
        response = await fetch("/api/outreach/articles/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school: "OKA", slug: "OKA" }),
        });
      } else if (jobType === "editors") {
        response = await fetch("/api/sync/outreach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school: "OKA", slug: "OKA" }),
        });
      } else {
        response = await fetch("/api/sync/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType }),
        });
      }

      if (response.ok) {
        toast({
          title: "Sync Started",
          description: `${jobType} sync has been triggered.`,
        });
      } else {
        throw new Error("Failed to trigger sync");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to trigger sync.",
        variant: "destructive",
      });
    } finally {
      triggerLockRef.current = null;
      setTriggeringSync(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
    > = {
      pending: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
      running: { variant: "default", icon: <RefreshCw className="w-3 h-3 animate-spin" /> },
      completed: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
      cancelled: { variant: "outline", icon: <Square className="w-3 h-3" /> },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getDuration = (job: SyncJob) => {
    if (!job.startedAt) return "-";
    const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
    const start = new Date(job.startedAt).getTime();
    return formatDuration(end - start);
  };

  const getProgress = (job: SyncJob) => {
    const total =
      job.metadata?.totalArticles ??
      job.metadata?.total ??
      job.metadata?.totalExpected ??
      job.metadata?.totalAgentRequests;
    const processed =
      job.metadata?.processedArticles ??
      job.metadata?.processed ??
      job.metadata?.processedAgentRequests;
    if (typeof total !== "number" || total <= 0) return 0;
    if (typeof processed !== "number" || processed <= 0) return 0;
    return Math.min(100, (processed / total) * 100);
  };

  const getProgressLabel = (job: SyncJob) => {
    const progress = getProgress(job);
    if (progress <= 0) return "0%";
    if (progress < 1) return "<1%";
    if (progress < 10) return `${progress.toFixed(1)}%`;
    return `${Math.round(progress)}%`;
  };

  const getProgressCounts = (job: SyncJob) => {
    const total =
      job.metadata?.totalArticles ??
      job.metadata?.total ??
      job.metadata?.totalExpected ??
      job.metadata?.totalAgentRequests;
    const processed =
      job.metadata?.processedArticles ??
      job.metadata?.processed ??
      job.metadata?.processedAgentRequests;

    return {
      total: typeof total === "number" ? total : 0,
      processed: typeof processed === "number" ? processed : 0,
    };
  };

  useEffect(() => {
    setJobLogsById((prev) => {
      const nextLogs = { ...prev };
      const nextState = new Map<
        string,
        {
          status: SyncJob["status"];
          stage: string;
          processed: number;
          total: number;
        }
      >();

      const appendLog = (jobId: string, entry: LiveLogEntry) => {
        const existing = nextLogs[jobId] ?? [];
        const duplicate = existing.some(
          (item) =>
            item.at === entry.at && item.message === entry.message && item.level === entry.level,
        );
        if (duplicate) {
          return;
        }
        const updated = [...existing, entry].slice(-120);
        nextLogs[jobId] = updated;
      };

      for (const job of jobs) {
        const previous = previousJobsRef.current.get(job.id);
        const stage = typeof job.metadata?.stage === "string" ? job.metadata.stage : "";
        const { processed, total } = getProgressCounts(job);
        const persistedLogs = Array.isArray(job.metadata?.logs)
          ? (job.metadata.logs as Array<{ at?: unknown; message?: unknown; level?: unknown }>)
          : [];

        for (const entry of persistedLogs) {
          if (typeof entry.at !== "string" || typeof entry.message !== "string") {
            continue;
          }

          const level =
            entry.level === "success" || entry.level === "error" || entry.level === "info"
              ? entry.level
              : "info";

          appendLog(job.id, {
            at: entry.at,
            level,
            message: entry.message,
          });
        }

        nextState.set(job.id, {
          status: job.status,
          stage,
          processed,
          total,
        });

        if (!previous) {
          appendLog(job.id, {
            at: new Date(job.createdAt).toISOString(),
            level: "info",
            message: `Job created (${job.jobType})`,
          });

          if (job.startedAt) {
            appendLog(job.id, {
              at: new Date(job.startedAt).toISOString(),
              level: "info",
              message: "Job started",
            });
          }

          if (stage) {
            appendLog(job.id, {
              at: new Date().toISOString(),
              level: "info",
              message: stage,
            });
          }
        }

        if (previous && previous.status !== job.status) {
          appendLog(job.id, {
            at: new Date().toISOString(),
            level:
              job.status === "completed" ? "success" : job.status === "failed" ? "error" : "info",
            message: `Status changed: ${previous.status} -> ${job.status}`,
          });
        }

        if (stage && stage !== previous?.stage) {
          appendLog(job.id, {
            at: new Date().toISOString(),
            level: "info",
            message: stage,
          });
        }

        if (total > 0 && processed > 0) {
          const currentBucket = Math.floor((processed / total) * 20);
          const previousBucket =
            previous && previous.total > 0
              ? Math.floor((previous.processed / previous.total) * 20)
              : -1;

          if (currentBucket > previousBucket) {
            appendLog(job.id, {
              at: new Date().toISOString(),
              level: "info",
              message: `Progress ${processed}/${total} (${getProgressLabel(job)})`,
            });
          }
        }

        if (job.error && job.error.length > 0) {
          const lastLog = (nextLogs[job.id] ?? []).at(-1);
          if (!lastLog || lastLog.message !== `Error: ${job.error}`) {
            appendLog(job.id, {
              at: new Date().toISOString(),
              level: "error",
              message: `Error: ${job.error}`,
            });
          }
        }
      }

      previousJobsRef.current = nextState;
      return nextLogs;
    });
  }, [jobs]);

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus !== "all" && job.status !== filterStatus) return false;
    if (filterType !== "all" && job.jobType !== filterType) return false;
    return true;
  });

  const jobTypes = [...new Set(jobs.map((j) => j.jobType))];

  const jobsById = new Map(filteredJobs.map((job) => [job.id, job]));
  const childrenByParent = new Map<string, SyncJob[]>();

  for (const job of filteredJobs) {
    if (!job.parentJobId) continue;
    const siblings = childrenByParent.get(job.parentJobId) ?? [];
    siblings.push(job);
    childrenByParent.set(job.parentJobId, siblings);
  }

  const orderedJobs: SyncJob[] = [];
  const renderedChildren = new Set<string>();

  for (const job of filteredJobs) {
    if (job.parentJobId) continue;
    orderedJobs.push(job);
    const children = childrenByParent.get(job.id) ?? [];
    children.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (const child of children) {
      orderedJobs.push(child);
      renderedChildren.add(child.id);
    }
  }

  for (const job of filteredJobs) {
    if (job.parentJobId && !jobsById.has(job.parentJobId) && !renderedChildren.has(job.id)) {
      orderedJobs.push(job);
    }
  }

  const displayJobs = orderedJobs.length > 0 ? orderedJobs : filteredJobs;

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sync Job Manager</h1>
          <p className="text-slate-600 mt-1">
            Monitor and manage background synchronization jobs in real-time.
          </p>
        </div>

        {/* Connection Status */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Connection Status
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Real-time synchronization status with the backend.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isConnected && !isLoading && (
                <Button variant="outline" size="sm" onClick={reconnect}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reconnect
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-sm font-medium text-slate-700">Connecting...</span>
                  </>
                ) : isConnected ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Connected to real-time updates
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-sm font-medium text-slate-700">
                      {error?.message || "Disconnected"}
                    </span>
                  </>
                )}
              </div>
              <div className="text-sm text-slate-500">
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Panel */}
        <Card>
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-900">Trigger New Sync</CardTitle>
            <p className="text-sm text-slate-500 mt-1">Manually start synchronization tasks.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handleTriggerSync("full")}
                size="sm"
                disabled={triggeringSync !== null}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {triggeringSync === "full" ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Full Sync
              </Button>
              {[
                { id: "contributions", label: "Contributions" },
                { id: "pageviews", label: "Pageviews" },
                { id: "commons", label: "Commons" },
                { id: "editors", label: "Editors" },
                { id: "outreach_articles", label: "Articles" },
              ].map((action) => (
                <Button
                  key={action.id}
                  onClick={() => handleTriggerSync(action.id)}
                  size="sm"
                  variant="outline"
                  disabled={triggeringSync !== null}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  {triggeringSync === action.id ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2 text-slate-400" />
                  )}
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Jobs Table */}
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">Job History</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Recent synchronization jobs and their status.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All</option>
                  {jobTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>No jobs found matching the selected filters.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Type</TableHead>
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700">Started</TableHead>
                      <TableHead className="font-semibold text-slate-700">Duration</TableHead>
                      <TableHead className="font-semibold text-slate-700">Progress</TableHead>
                      <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayJobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium">
                          {job.parentJobId ? (
                            <div className="relative flex items-center gap-2 pl-6">
                              <span className="absolute left-2 top-0 bottom-0 w-px bg-slate-200" />
                              <span className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 border-l border-b border-slate-200 rounded-bl-sm" />
                              <span className="text-slate-600 text-xs">{job.jobType}</span>
                            </div>
                          ) : (
                            <span className="text-slate-900">{job.jobType}</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-slate-600 text-xs">
                          {job.startedAt ? new Date(job.startedAt).toLocaleString() : "-"}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs font-mono">
                          {getDuration(job)}
                        </TableCell>
                        <TableCell>
                          {job.status === "running" && getProgressCounts(job).total > 0 ? (
                            <div className="w-32">
                              <Progress value={getProgress(job)} className="h-1.5 mb-1" />
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>{getProgressLabel(job)}</span>
                                <span>
                                  {getProgressCounts(job).processed}/{getProgressCounts(job).total}
                                </span>
                              </div>
                              {typeof job.metadata?.stage === "string" &&
                              job.metadata.stage.length > 0 ? (
                                <div
                                  className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]"
                                  title={job.metadata.stage}
                                >
                                  {job.metadata.stage}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {job.status === "running" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setJobToCancel(job.id)}
                                title="Stop Job"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" />
                              </Button>
                            )}
                            {(job.status === "failed" || job.status === "cancelled") && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                onClick={() => handleRetryJob(job.id)}
                                title="Retry Job"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {job.status !== "running" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                onClick={() => setJobToDelete(job.id)}
                                title="Delete Job Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                  title="Job Details"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Job Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-sm font-medium">ID</label>
                                      <p className="text-sm text-muted-foreground font-mono">
                                        {job.id}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Type</label>
                                      <p className="text-sm text-muted-foreground">{job.jobType}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Status</label>
                                      <p className="text-sm text-muted-foreground">{job.status}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium">Created</label>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(job.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                    {job.startedAt && (
                                      <div>
                                        <label className="text-sm font-medium">Started</label>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(job.startedAt).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                    {job.completedAt && (
                                      <div>
                                        <label className="text-sm font-medium">Completed</label>
                                        <p className="text-sm text-muted-foreground">
                                          {new Date(job.completedAt).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  {job.error && (
                                    <div>
                                      <label className="text-sm font-medium text-destructive">
                                        Error
                                      </label>
                                      <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                        {job.error}
                                      </p>
                                    </div>
                                  )}
                                  {job.metadata && (
                                    <div>
                                      <label className="text-sm font-medium">Metadata</label>
                                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                                        {JSON.stringify(job.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <label className="text-sm font-medium">Live Logs</label>
                                      <span className="text-xs text-muted-foreground">
                                        {(jobLogsById[job.id] ?? []).length} entries
                                      </span>
                                    </div>
                                    <div className="mt-2 max-h-64 overflow-auto rounded border bg-slate-950 text-slate-100">
                                      {(jobLogsById[job.id] ?? []).length === 0 ? (
                                        <p className="px-3 py-2 text-xs text-slate-400">
                                          No logs yet.
                                        </p>
                                      ) : (
                                        <div className="divide-y divide-slate-800">
                                          {(jobLogsById[job.id] ?? []).map((entry, index) => (
                                            <div
                                              key={`${entry.at}-${index}`}
                                              className="px-3 py-2 text-xs font-mono"
                                            >
                                              <div className="text-slate-400">
                                                {new Date(entry.at).toLocaleTimeString()}
                                              </div>
                                              <div
                                                className={
                                                  entry.level === "error"
                                                    ? "text-rose-300"
                                                    : entry.level === "success"
                                                      ? "text-emerald-300"
                                                      : "text-slate-100"
                                                }
                                              >
                                                {entry.message}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {(() => {
                                    const errorsSample = (
                                      job.metadata as {
                                        errorsSample?: Array<{ articleId: number; error: string }>;
                                      }
                                    )?.errorsSample;

                                    if (!errorsSample || errorsSample.length === 0) {
                                      return null;
                                    }

                                    return (
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <label className="text-sm font-medium text-destructive">
                                            Error Samples
                                          </label>
                                          <span className="text-xs text-muted-foreground">
                                            {errorsSample.length} items
                                          </span>
                                        </div>
                                        <div className="mt-2 max-h-56 overflow-auto rounded border border-destructive/20 bg-destructive/5">
                                          <div className="divide-y divide-destructive/20">
                                            {errorsSample.map((item) => (
                                              <div
                                                key={`${item.articleId}-${item.error}`}
                                                className="px-3 py-2"
                                              >
                                                <div className="text-xs font-mono text-destructive">
                                                  Article {item.articleId}
                                                </div>
                                                <div className="text-xs text-destructive/80 break-words">
                                                  {item.error}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={jobToCancel !== null} onOpenChange={(open) => !open && setJobToCancel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stop Sync Job?</DialogTitle>
              <DialogDescription>
                Are you sure you want to stop this sync job? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  if (jobToCancel) {
                    handleCancelJob(jobToCancel);
                    setJobToCancel(null);
                  }
                }}
              >
                Stop Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={jobToDelete !== null} onOpenChange={(open) => !open && setJobToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Job?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this job record? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  if (jobToDelete) {
                    handleDeleteJob(jobToDelete);
                    setJobToDelete(null);
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
