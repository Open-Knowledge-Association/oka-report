import { ActivityCalendar } from "react-activity-calendar";

interface DailyStat {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
}

interface ActivityHeatmapProps {
  dailyStats: DailyStat[];
}

export function ActivityHeatmap({ dailyStats }: ActivityHeatmapProps) {
  if (!dailyStats || dailyStats.length === 0) {
    return (
      <div
        data-testid="activity-heatmap-empty"
        className="h-32 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No activity data</p>
      </div>
    );
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const filteredStats = dailyStats.filter((stat) => new Date(stat.date) >= oneYearAgo);

  if (filteredStats.length === 0) {
    return (
      <div
        data-testid="activity-heatmap-empty"
        className="h-32 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No activity data in the last year</p>
      </div>
    );
  }

  const activityData = filteredStats.map((stat) => ({
    date: stat.date.split("T")[0],
    count: stat.edits,
    level: Math.min(Math.floor(stat.edits / 10), 4),
  }));

  const theme = {
    light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  };

  return (
    <div data-testid="activity-heatmap" className="w-full overflow-x-auto">
      <ActivityCalendar
        data={activityData}
        theme={theme}
        colorScheme="light"
        labels={{
          months: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ],
          weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          totalCount: "{{count}} edits in the last year",
          legend: {
            less: "Less",
            more: "More",
          },
        }}
      />
    </div>
  );
}
