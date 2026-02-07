import type { PageviewData } from "./types";
import type { WikimediaClient } from "./client";

const PAGEVIEWS_BASE_URL = "https://wikimedia.org/api/rest_v1";

export type PageviewAgentType = "user" | "all-agents";

type PageviewsResponse = {
  items?: Array<{
    timestamp: string;
    views: number;
  }>;
};

const formatDate = (timestamp: string) => {
  if (timestamp.length < 8) {
    return timestamp;
  }

  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  return `${year}-${month}-${day}`;
};

export const getPageviews = async (
  client: WikimediaClient,
  article: string,
  project: string,
  startDate: string,
  endDate: string,
  agentType: PageviewAgentType = "all-agents",
): Promise<PageviewData[]> => {
  // Normalize title: Wikimedia Pageviews API expects underscores instead of spaces
  const normalizedTitle = article.replace(/ /g, "_");
  const encodedArticle = encodeURIComponent(normalizedTitle);
  const endpoint = `${PAGEVIEWS_BASE_URL}/metrics/pageviews/per-article/${project}/all-access/${agentType}/${encodedArticle}/daily/${startDate}/${endDate}`;

  const response = await client.request<PageviewsResponse>(endpoint);

  return (response.items ?? []).map((item) => ({
    date: formatDate(item.timestamp),
    views: item.views,
  }));
};
