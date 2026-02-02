import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimeSeriesPoint {
  date: string;
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  granularity: "daily" | "weekly" | "monthly";
}

const formatDate = (dateStr: string, granularity: string) => {
  const date = new Date(dateStr);
  if (granularity === "monthly") {
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }
  if (granularity === "weekly") {
    return `Week ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function TimeSeriesChart({ data, granularity }: TimeSeriesChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    formattedDate: formatDate(point.date, granularity),
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 12 }}
            stroke="#64748b"
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="edits"
            name="Edits"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="articlesCreated"
            name="Articles Created"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
