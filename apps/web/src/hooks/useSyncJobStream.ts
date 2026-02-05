import { useState, useEffect, useRef } from "react";

export interface SyncJob {
  id: string;
  jobType: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata?: any;
  createdAt: string;
  isCancelled?: boolean;
}

interface UseSyncJobStreamReturn {
  jobs: SyncJob[];
  isConnected: boolean;
  error: Error | null;
}

export function useSyncJobStream(): UseSyncJobStreamReturn {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const eventSource = new EventSource("/api/sync/stream");
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
          setRetryCount(0);
        };

        eventSource.addEventListener("job-update", (event) => {
          try {
            const updatedJobs = JSON.parse(event.data) as SyncJob[];
            setJobs(updatedJobs);
          } catch (parseError) {
            console.error("Failed to parse job update:", parseError);
          }
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();

          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

          setError(new Error(`Connection lost. Reconnecting in ${backoffDelay / 1000}s...`));

          reconnectTimeoutRef.current = setTimeout(() => {
            setRetryCount((prev) => prev + 1);
            connect();
          }, backoffDelay);
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to connect to stream";
        setError(new Error(errorMessage));
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [retryCount]);

  return {
    jobs,
    isConnected,
    error,
  };
}
