import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface TrendRow {
  month: string;
  edits: number;
  viewsTotal: number;
  articlesCreated: number;
}

export function MonthlyTrendChart({ data }: { data: TrendRow[] }) {
  if (!data.length) return null;

  const labels = data.map((row) => row.month);
  const chartData = {
    labels,
    datasets: [
      {
        label: "Edits",
        data: data.map((row) => row.edits),
        borderColor: "#2563eb",
        backgroundColor: "#2563eb",
        tension: 0.3,
        yAxisID: "y",
      },
      {
        label: "Articles created",
        data: data.map((row) => row.articlesCreated),
        borderColor: "#16a34a",
        backgroundColor: "#16a34a",
        tension: 0.3,
        yAxisID: "y",
      },
      {
        label: "Views (total)",
        data: data.map((row) => row.viewsTotal),
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        tension: 0.3,
        yAxisID: "y1",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      y: {
        type: "linear" as const,
        position: "left" as const,
        title: { display: true, text: "Edits / Created" },
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Views" },
      },
    },
  };

  return (
    <div data-testid="monthly-trend-chart" className="h-72 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
}
