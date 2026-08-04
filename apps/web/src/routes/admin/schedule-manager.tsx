import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchSchedulerInfo,
  updateSchedulerSettingWithReason,
  fetchSchedulerEvents,
  fetchSchedulerLogs,
  type SchedulerJob,
} from "@/lib/api";

export const Route = createFileRoute("/admin/schedule-manager")({
  component: ScheduleManagerPage,
});

const formatParams = (job: SchedulerJob) => {
  if (!job.params) return "-";
  return Object.entries(job.params)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
};

function ScheduleManagerPage() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<SchedulerJob | null>(null);
  const [reason, setReason] = useState("");
  const [showLogsFor, setShowLogsFor] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["scheduler", "info"],
    queryFn: fetchSchedulerInfo,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled, reason }: { id: string; enabled: boolean; reason?: string }) =>
      updateSchedulerSettingWithReason(id, enabled, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduler", "info"] });
    },
  });

  const eventsQuery = useQuery({
    queryKey: ["scheduler", "events", showLogsFor],
    queryFn: () => fetchSchedulerEvents(showLogsFor ?? ""),
    enabled: Boolean(showLogsFor),
  });

  const logsQuery = useQuery({
    queryKey: ["scheduler", "logs", showLogsFor],
    queryFn: () => fetchSchedulerLogs(showLogsFor ?? ""),
    enabled: Boolean(showLogsFor),
  });

  const jobs = data?.jobs ?? [];

  const handleRun = async (job: SchedulerJob) => {
    const trigger = job.triggers?.[0];
    if (!trigger) return;
    await fetch(trigger.path, {
      method: trigger.method,
      headers: { "Content-Type": "application/json" },
      body: trigger.payload ? JSON.stringify(trigger.payload) : undefined,
    });
  };

  const handleToggleClick = (job: SchedulerJob) => {
    if (job.enabled) {
      setSelectedJob(job);
      setReason("");
      return;
    }
    toggleMutation.mutate({ id: job.id, enabled: true });
  };

  const submitDisable = () => {
    if (!selectedJob) return;
    toggleMutation.mutate({
      id: selectedJob.id,
      enabled: false,
      reason: reason.trim(),
    });
    setSelectedJob(null);
    setReason("");
  };

  return (
    <>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Schedule Manager</h1>
          <p className="text-slate-600 mt-1">Monitor scheduled jobs and run them on demand.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">Scheduled Jobs</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Timezone: <span className="font-mono">{data?.timezone ?? "UTC"}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 shadow-sm">
              <Calendar className="h-3.5 w-3.5" />
              {jobs.length} jobs
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Job</TableHead>
                    <TableHead className="font-semibold text-slate-700">Type</TableHead>
                    <TableHead className="font-semibold text-slate-700">Schedule</TableHead>
                    <TableHead className="font-semibold text-slate-700">Params</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-sm text-slate-500">
                        Loading schedules...
                      </TableCell>
                    </TableRow>
                  ) : jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-sm text-slate-500">
                        No schedules found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <div className="font-medium text-slate-900">{job.name}</div>
                          <div className="text-xs text-muted-foreground">{job.description}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{job.type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-mono text-xs">{job.schedule}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {formatParams(job)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={job.enabled ? "default" : "outline"}
                            className={`h-7 text-xs ${
                              job.enabled
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "text-slate-500 border-slate-200"
                            }`}
                            onClick={() => handleToggleClick(job)}
                          >
                            {job.enabled ? "Enabled" : "Disabled"}
                          </Button>
                          {!job.enabled && job.disabledReason && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 w-fit">
                              Reason: {job.disabledReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {job.triggers?.length ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1.5"
                                onClick={() => handleRun(job)}
                              >
                                <PlayCircle className="h-3.5 w-3.5" />
                                Run now
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic px-2">
                                No trigger
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-slate-500"
                              onClick={() => setShowLogsFor(job.id)}
                            >
                              View log
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disable {selectedJob?.name}</DialogTitle>
              <DialogDescription>
                Add a reason so other admins know why this schedule is paused.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Example: maintenance, data fix, API quota"
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedJob(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={submitDisable}>
                Disable Job
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showLogsFor} onOpenChange={(open) => !open && setShowLogsFor(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Scheduler Log</DialogTitle>
              <DialogDescription>Recent events and execution logs for this job.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 h-[400px]">
              <div className="flex flex-col h-full">
                <h3 className="font-medium text-sm text-slate-900 mb-3">Setting Events</h3>
                <div className="flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
                  {(eventsQuery.data?.events ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      No events recorded.
                    </p>
                  ) : (
                    eventsQuery.data?.events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded bg-white border border-slate-200 p-2.5 text-xs shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`font-medium ${
                              event.enabled ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {event.enabled ? "Enabled" : "Disabled"}
                          </span>
                          <span className="text-slate-400">
                            {new Date(event.createdAt).toLocaleDateString()}{" "}
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        {event.reason && (
                          <p className="text-slate-600 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                            {event.reason}
                          </p>
                        )}
                        {event.source && (
                          <p className="text-slate-400 mt-1 text-[10px]">Source: {event.source}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-col h-full">
                <h3 className="font-medium text-sm text-slate-900 mb-3">Run Logs</h3>
                <div className="flex-1 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
                  {(logsQuery.data?.logs ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      No logs recorded.
                    </p>
                  ) : (
                    logsQuery.data?.logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded bg-white border border-slate-200 p-2.5 text-xs shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-700">{log.jobType}</span>
                          <span className="text-slate-400">
                            {new Date(log.createdAt).toLocaleDateString()}{" "}
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Status:</span>
                          <span
                            className={`font-medium ${
                              log.status === "error" || log.error
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        {log.error ? (
                          <p className="text-rose-600 mt-1 bg-rose-50 p-1.5 rounded border border-rose-100 break-words">
                            {log.error}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowLogsFor(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
