import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

export type OverallStats = {
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesModified: number;
  commonsUploads: number;
};

export type WikiProjectStats = OverallStats & {
  wikiProject: string;
};

export type OverallStatsResponse = {
  totals: OverallStats;
  byWikiProject: WikiProjectStats[];
};

export type TimeSeriesPoint = {
  date: string;
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
};

export type TimeSeriesResponse = {
  granularity: string;
  series: TimeSeriesPoint[];
};

export const useOverallStats = () =>
  useQuery({
    queryKey: ["stats", "overall"],
    queryFn: () => apiFetch<OverallStatsResponse>("/stats/overall"),
  });

export const useTimeSeries = () =>
  useQuery({
    queryKey: ["stats", "timeseries"],
    queryFn: () => apiFetch<TimeSeriesResponse>("/stats/timeseries"),
  });
