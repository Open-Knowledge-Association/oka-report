import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import type { TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Article {
  id: string;
  title: string;
  wikiProject?: string;
  language?: string;
  project?: string;
}

interface WikiDistributionChartProps {
  articles: Article[];
}

export function WikiDistributionChart({ articles }: WikiDistributionChartProps) {
  if (!articles || articles.length === 0) {
    return (
      <div
        data-testid="wiki-distribution-chart-empty"
        className="h-64 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No wiki distribution data</p>
      </div>
    );
  }

  const wikiCounts = articles.reduce(
    (acc, article) => {
      const wiki = article.wikiProject
        ? article.wikiProject.replace(".org", "")
        : `${article.language}.${article.project}`;
      acc[wiki] = (acc[wiki] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const sortedWikis = Object.entries(wikiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const total = articles.length;
  const topWikisTotal = sortedWikis.reduce((sum, [, count]) => sum + count, 0);
  const otherCount = total - topWikisTotal;

  const labels = sortedWikis.map(([wiki]) => wiki);
  const data = sortedWikis.map(([, count]) => count);

  if (otherCount > 0) {
    labels.push("Other");
    data.push(otherCount);
  }

  const colors = [
    "rgb(59, 130, 246)",
    "rgb(16, 185, 129)",
    "rgb(245, 158, 11)",
    "rgb(239, 68, 68)",
    "rgb(139, 92, 246)",
    "rgb(236, 72, 153)",
    "rgb(107, 114, 128)",
  ];

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors
          .slice(0, labels.length)
          .map((c) => c.replace("rgb", "rgba").replace(")", ", 0.8)")),
        borderWidth: 2,
      },
    ],
  };

  return (
    <div data-testid="wiki-distribution-chart" className="w-full h-80">
      <Doughnut
        data={chartData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Articles by Wiki Project",
            },
            legend: {
              position: "right" as const,
            },
            tooltip: {
              callbacks: {
                label: (context: TooltipItem<"doughnut">) => {
                  const value = (context.raw as number) || 0;
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${context.label}: ${value} articles (${percentage}%)`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
