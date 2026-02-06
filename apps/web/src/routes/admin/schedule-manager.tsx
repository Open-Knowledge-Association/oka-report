import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Calendar, Clock, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Schedule Manager</h1>
        <p className="text-slate-600 mt-1">Monitor scheduled jobs and run them on demand.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Scheduled Jobs</CardTitle>
            <p className="text-sm text-muted-foreground">Timezone: {data?.timezone ?? "UTC"}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {jobs.length} jobs
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Params</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading schedules...
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No schedules found.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="font-medium text-slate-900">{job.name}</div>
                        <div className="text-xs text-muted-foreground">{job.description}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {job.schedule}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatParams(job)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={job.enabled ? "default" : "outline"}
                          onClick={() => handleToggleClick(job)}
                        >
                          {job.enabled ? "Enabled" : "Disabled"}
                        </Button>
                        {!job.enabled && job.disabledReason && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {job.disabledReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {job.triggers?.length ? (
                          <Button size="sm" variant="outline" onClick={() => handleRun(job)}>
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Run now
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No action</span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2"
                          onClick={() => setShowLogsFor(job.id)}
                        >
                          View log
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-slate-900">Disable {selectedJob.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add a reason so other admins know why this schedule is paused.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <textarea
                className="w-full min-h-[90px] rounded-md border border-slate-200 p-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Example: maintenance, data fix, API quota"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>
                Cancel
              </Button>
              <Button onClick={submitDisable}>Disable</Button>
            </div>
          </div>
        </div>
      )}

      {showLogsFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Scheduler Log</h2>
              <Button variant="ghost" onClick={() => setShowLogsFor(null)}>
                Close
              </Button>
            </div>
            <div className="mt-4 space-y-3 max-h-64 overflow-auto">
              {(eventsQuery.data?.events ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                eventsQuery.data?.events.map((event) => (
                  <div key={event.id} className="rounded border border-slate-200 p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.enabled ? "Enabled" : "Disabled"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {event.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{event.reason}</p>
                    )}
                    {event.source && (
                      <p className="text-xs text-muted-foreground">Source: {event.source}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
