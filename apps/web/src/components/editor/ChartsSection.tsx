import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContributionTimelineChart } from "./ContributionTimelineChart";
import { PageviewsChart } from "./PageviewsChart";
import { ActivityHeatmap } from "./ActivityHeatmap";
import { WikiDistributionChart } from "./WikiDistributionChart";

interface Article {
  id: string;
  title: string;
  url: string;
  wikiProject?: string;
  language?: string;
  project?: string;
  characterSum: number;
  referencesCount: number;
  isNewArticle?: boolean;
  rating?: string | null;
  pageviews?: Array<{
    type: string;
    views?: number;
    cumulativeViews?: number;
    date: string;
  }>;
}

interface DailyStat {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
}

interface ChartsSectionProps {
  editorId: string;
  articles: Article[];
  dailyStats?: DailyStat[];
}

export function ChartsSection({ editorId, articles, dailyStats }: ChartsSectionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div data-testid="charts-section-mobile">
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="pageviews">Pageviews</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="distribution">Wiki</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            <ContributionTimelineChart editorId={editorId} />
          </TabsContent>
          <TabsContent value="pageviews" className="mt-4">
            <PageviewsChart articles={articles} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityHeatmap dailyStats={dailyStats || []} />
          </TabsContent>
          <TabsContent value="distribution" className="mt-4">
            <WikiDistributionChart articles={articles} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div data-testid="charts-section-desktop" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Contribution Timeline</h3>
          <ContributionTimelineChart editorId={editorId} />
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Activity Heatmap</h3>
          <ActivityHeatmap dailyStats={dailyStats || []} />
        </div>
      </div>
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Pageviews per Article</h3>
          <PageviewsChart articles={articles} />
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">Wiki Distribution</h3>
          <WikiDistributionChart articles={articles} />
        </div>
      </div>
    </div>
  );
}
