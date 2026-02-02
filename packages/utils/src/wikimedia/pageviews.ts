import type { PageviewData } from "./types";
import type { WikimediaClient } from "./client";

const PAGEVIEWS_BASE_URL = "https://wikimedia.org/api/rest_v1";

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
): Promise<PageviewData[]> => {
  const encodedArticle = encodeURIComponent(article);
  const endpoint = `${PAGEVIEWS_BASE_URL}/metrics/pageviews/per-article/${project}/all-access/user/${encodedArticle}/daily/${startDate}/${endDate}`;

  const response = await client.request<PageviewsResponse>(endpoint);

  return (response.items ?? []).map((item) => ({
    date: formatDate(item.timestamp),
    views: item.views,
  }));
};
