import type { WikimediaClient } from "./client";
import type { GetUserContributionsOptions, UserContribution } from "./types";

type UserContribResponse = {
  query?: {
    usercontribs?: Array<{
      userid: number;
      user: string;
      pageid: number;
      revid: number;
      parentid?: number;
      ns: number;
      title: string;
      timestamp: string;
      sizediff: number;
    }>;
  };
  continue?: Record<string, string>;
};

export const getUserContributions = async (
  client: WikimediaClient,
  username: string,
  options: GetUserContributionsOptions = {},
): Promise<UserContribution[]> => {
  const results: UserContribution[] = [];
  let continueParams: Record<string, string> | undefined;

  do {
    const response = await client.request<UserContribResponse>("/w/api.php", {
      action: "query",
      list: "usercontribs",
      format: "json",
      ucuser: username,
      ucprop: "ids|title|timestamp|sizediff|parentid",
      uclimit: options.limit ?? "max",
      ucstart: options.start,
      ucend: options.end,
      ...continueParams,
    });

    const contributions = response.query?.usercontribs ?? [];
    results.push(
      ...contributions.map((contrib) => ({
        pageId: contrib.pageid,
        revisionId: contrib.revid,
        parentId: contrib.parentid,
        namespace: contrib.ns,
        title: contrib.title,
        timestamp: contrib.timestamp,
        sizeDiff: contrib.sizediff,
        userId: contrib.userid,
        username: contrib.user,
      })),
    );

    continueParams = response.continue;
  } while (continueParams);

  return results;
};
