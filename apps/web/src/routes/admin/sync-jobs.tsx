import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
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
  const { jobs, isConnected, isLoading, error, reconnect } = useSyncJobStream();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [jobToCancel, setJobToCancel] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [triggeringSync, setTriggeringSync] = useState<string | null>(null);
  const triggerLockRef = useRef<string | null>(null);

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
    const total = job.metadata?.total || job.metadata?.totalExpected;
    const processed = job.metadata?.processed;
    if (!total || !processed) return 0;
    return Math.round((processed / total) * 100);
  };

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
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sync Job Manager</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage background synchronization jobs in real-time.
        </p>
      </div>

      {/* Connection Status */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-sm">Connecting...</span>
                </>
              ) : isConnected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">Connected to real-time updates</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-sm">{error?.message || "Disconnected"}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
              </div>
              {!isConnected && !isLoading && (
                <Button variant="outline" size="sm" onClick={reconnect}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reconnect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trigger Panel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trigger New Sync</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleTriggerSync("full")}
              size="sm"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "full" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Full Sync
            </Button>
            <Button
              onClick={() => handleTriggerSync("contributions")}
              size="sm"
              variant="outline"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "contributions" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Contributions
            </Button>
            <Button
              onClick={() => handleTriggerSync("pageviews")}
              size="sm"
              variant="outline"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "pageviews" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Pageviews
            </Button>
            <Button
              onClick={() => handleTriggerSync("commons")}
              size="sm"
              variant="outline"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "commons" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Commons
            </Button>
            <Button
              onClick={() => handleTriggerSync("editors")}
              size="sm"
              variant="outline"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "editors" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Editors
            </Button>
            <Button
              onClick={() => handleTriggerSync("outreach_articles")}
              size="sm"
              variant="outline"
              disabled={triggeringSync !== null}
            >
              {triggeringSync === "outreach_articles" ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Articles
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
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
              <label className="text-sm font-medium">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
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
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p>No jobs found matching the selected filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.parentJobId ? (
                        <div className="relative flex items-center gap-2 pl-8">
                          <span className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                          <span className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 border-l border-b border-border" />
                          <span className="text-muted-foreground">{job.jobType}</span>
                        </div>
                      ) : (
                        job.jobType
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell>{getDuration(job)}</TableCell>
                    <TableCell>
                      {job.status === "running" &&
                      (job.metadata?.total || job.metadata?.totalExpected) ? (
                        <div className="w-32">
                          <Progress value={getProgress(job)} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {getProgress(job)}% ({job.metadata?.processed || 0}/
                            {job.metadata?.total || job.metadata?.totalExpected})
                          </span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {job.status === "running" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setJobToCancel(job.id)}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}
                        {(job.status === "failed" || job.status === "cancelled") && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRetryJob(job.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        {job.status !== "running" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setJobToDelete(job.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost">
                              <Info className="w-4 h-4" />
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
  );
}
