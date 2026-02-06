import { useState, useEffect, useRef, useCallback } from "react";

export interface SyncJob {
  id: string;
  parentJobId?: string;
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
  isLoading: boolean;
  error: Error | null;
  reconnect: () => void;
}

export function useSyncJobStream(): UseSyncJobStreamReturn {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [forceReconnect, setForceReconnect] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualReconnect = useRef(false);

  const reconnect = useCallback(() => {
    isManualReconnect.current = true;
    setForceReconnect((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    const connect = () => {
      if (!isActive) return;

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        setIsLoading(true);
        const eventSource = new EventSource("/api/sync/stream");
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          if (!isActive) return;
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
          setRetryCount(0);
          isManualReconnect.current = false;
        };

        eventSource.addEventListener("job-update", (event) => {
          if (!isActive) return;
          try {
            const updatedJobs = JSON.parse(event.data) as SyncJob[];
            setJobs(updatedJobs);
            setIsLoading(false);
          } catch (parseError) {
            console.error("Failed to parse job update:", parseError);
          }
        });

        eventSource.onerror = () => {
          if (!isActive) return;

          setIsConnected(false);
          setIsLoading(false);
          eventSource.close();

          if (isManualReconnect.current) {
            isManualReconnect.current = false;
            return;
          }

          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

          if (retryCount === 0) {
            setError(new Error("Connecting to real-time updates..."));
          } else {
            setError(new Error(`Connection lost. Reconnecting in ${backoffDelay / 1000}s...`));
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isActive) {
              setRetryCount((prev) => prev + 1);
            }
          }, backoffDelay);
        };
      } catch (err) {
        if (!isActive) return;
        const errorMessage = err instanceof Error ? err.message : "Failed to connect to stream";
        setError(new Error(errorMessage));
        setIsConnected(false);
        setIsLoading(false);
      }
    };

    connect();

    return () => {
      isActive = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [retryCount, forceReconnect]);

  return {
    jobs,
    isConnected,
    isLoading,
    error,
    reconnect,
  };
}
