import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Article {
  id: string;
  title: string;
  url: string;
  characterSum: number;
  referencesCount: number;
  pageviews?: Array<{
    type: string;
    views?: number;
    cumulativeViews?: number;
    date: string;
  }>;
}

interface PageviewsChartProps {
  articles: Article[];
}

export function PageviewsChart({ articles }: PageviewsChartProps) {
  if (!articles || articles.length === 0) {
    return (
      <div
        data-testid="pageviews-chart-empty"
        className="h-64 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No articles with pageview data</p>
      </div>
    );
  }

  // Calculate total pageviews per article and sort
  const articlesWithPageviews = articles
    .map((article) => {
      const totalPageviews =
        article.pageviews?.reduce((sum, pv) => {
          return sum + (pv.cumulativeViews ?? pv.views ?? 0);
        }, 0) ?? 0;
      return { ...article, totalPageviews };
    })
    .filter((article) => article.totalPageviews > 0)
    .sort((a, b) => b.totalPageviews - a.totalPageviews)
    .slice(0, 10); // Top 10

  if (articlesWithPageviews.length === 0) {
    return (
      <div
        data-testid="pageviews-chart-empty"
        className="h-64 w-full flex items-center justify-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No pageview data available</p>
      </div>
    );
  }

  const chartData = {
    labels: articlesWithPageviews.map((article) =>
      article.title.length > 30 ? article.title.substring(0, 30) + "..." : article.title,
    ),
    datasets: [
      {
        label: "Pageviews",
        data: articlesWithPageviews.map((article) => article.totalPageviews),
        backgroundColor: "rgba(59, 130, 246, 0.8)",
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: "Top 10 Articles by Pageviews",
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items: Array<{ dataIndex: number }>) => {
            return articlesWithPageviews[items[0].dataIndex].title;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Pageviews",
        },
      },
    },
    onClick: (_event: unknown, elements: Array<{ index: number }>) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const article = articlesWithPageviews[index];
        if (article?.url) {
          window.open(article.url, "_blank");
        }
      }
    },
  };

  return (
    <div data-testid="pageviews-chart" className="w-full h-96">
      <Bar data={chartData} options={options} />
    </div>
  );
}
