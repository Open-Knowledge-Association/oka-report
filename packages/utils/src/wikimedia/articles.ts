import type { WikimediaClient } from "./client";
import type { ArticleInfo } from "./types";

type ArticleInfoResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        missing?: boolean;
        revisions?: Array<{
          user?: string;
          timestamp?: string;
        }>;
      }
    >;
  };
};

export const getArticleInfo = async (
  client: WikimediaClient,
  title: string,
): Promise<ArticleInfo | null> => {
  const response = await client.request<ArticleInfoResponse>("/w/api.php", {
    action: "query",
    format: "json",
    titles: title,
    prop: "revisions",
    rvprop: "timestamp|user",
    rvlimit: 1,
    rvdir: "newer",
  });

  const pages = response.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing || !page.pageid) {
    return null;
  }

  const revision = page.revisions?.[0];
  if (!revision?.user || !revision.timestamp || !page.title) {
    return null;
  }

  return {
    pageId: page.pageid,
    title: page.title,
    creator: revision.user,
    createdAt: revision.timestamp,
  };
};
