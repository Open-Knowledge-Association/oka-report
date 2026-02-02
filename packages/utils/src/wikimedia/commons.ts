import type { CommonsUpload } from "./types";
import type { WikimediaClient } from "./client";

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";

type CommonsResponse = {
  query?: {
    allimages?: Array<{
      name: string;
      url: string;
      size?: number;
      mime?: string;
      timestamp: string;
    }>;
  };
  continue?: Record<string, string>;
};

export const getCommonsUploads = async (
  client: WikimediaClient,
  username: string,
): Promise<CommonsUpload[]> => {
  const uploads: CommonsUpload[] = [];
  let continueParams: Record<string, string> | undefined;

  do {
    const response = await client.request<CommonsResponse>(COMMONS_API_URL, {
      action: "query",
      format: "json",
      list: "allimages",
      aisort: "timestamp",
      aiuser: username,
      aiprop: "timestamp|url|size|mime",
      ailimit: "max",
      ...continueParams,
    });

    const images = response.query?.allimages ?? [];
    uploads.push(
      ...images.map((image) => ({
        fileName: image.name,
        fileUrl: image.url,
        fileSize: image.size,
        mimeType: image.mime,
        uploadedAt: image.timestamp,
      })),
    );

    continueParams = response.continue;
  } while (continueParams);

  return uploads;
};
