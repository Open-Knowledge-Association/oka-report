import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface DailyStat {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
}

interface ContributionTimelineChartProps {
  editorId: string;
}

export function ContributionTimelineChart({ editorId }: ContributionTimelineChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["editor", "daily-stats", editorId],
    queryFn: async () => {
      const response = await fetch(`/api/editors/${editorId}/daily-stats`);
      if (!response.ok) {
        throw new Error("Failed to fetch daily stats");
      }
      const result = await response.json();
      return result.data as DailyStat[];
    },
  });

  if (isLoading) {
    return (
      <div
        data-testid="contribution-timeline-chart-loading"
        className="h-64 w-full animate-pulse bg-slate-200 rounded"
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        data-testid="contribution-timeline-chart-empty"
        className="h-64 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No activity data available</p>
      </div>
    );
  }

  const chartData = {
    labels: data.map((stat) => new Date(stat.date).toLocaleDateString()),
    datasets: [
      {
        label: "Edits",
        data: data.map((stat) => stat.edits),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        yAxisID: "y",
      },
      {
        label: "Words Added",
        data: data.map((stat) => stat.wordsAdded),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        yAxisID: "y1",
      },
    ],
  };

  const options = {
    responsive: true,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: "Contribution Timeline",
      },
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Edits",
        },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        title: {
          display: true,
          text: "Words Added",
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div data-testid="contribution-timeline-chart" className="w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
