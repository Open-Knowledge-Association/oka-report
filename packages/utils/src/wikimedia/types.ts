export interface UserContribution {
  pageId: number;
  revisionId: number;
  parentId?: number;
  namespace: number;
  title: string;
  timestamp: string;
  sizeDiff: number;
  userId: number;
  username: string;
}

export interface GetUserContributionsOptions {
  limit?: number;
  start?: string;
  end?: string;
}

export interface ArticleInfo {
  pageId: number;
  title: string;
  creator: string;
  createdAt: string;
}

export interface PageviewData {
  date: string;
  views: number;
}

export interface CommonsUpload {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
}
