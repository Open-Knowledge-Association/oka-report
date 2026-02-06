import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CommonsUpload {
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedAt: string;
}

interface CommonsGalleryProps {
  editorId: string;
}

export function CommonsGallery({ editorId }: CommonsGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<CommonsUpload | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["editor", "commons-uploads", editorId],
    queryFn: async () => {
      const response = await fetch(`/api/editors/${editorId}/commons-uploads`);
      if (!response.ok) {
        throw new Error("Failed to fetch commons uploads");
      }
      const result = await response.json();
      return result.data as CommonsUpload[];
    },
  });

  if (isLoading) {
    return (
      <div
        data-testid="commons-gallery-loading"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square bg-slate-200 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        data-testid="commons-gallery-empty"
        className="py-12 text-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No Commons uploads yet</p>
      </div>
    );
  }

  return (
    <>
      <div
        data-testid="commons-gallery"
        className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4"
      >
        {data.map((upload) => (
          <div
            key={upload.fileName}
            className="group relative aspect-square bg-slate-100 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
            onClick={() => setSelectedImage(upload)}
          >
            {upload.thumbnailUrl ? (
              <img
                src={upload.thumbnailUrl}
                alt={upload.fileName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-slate-400 text-sm">{upload.mimeType}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs truncate">{upload.fileName}</p>
              <p className="text-white/70 text-xs">
                {new Date(upload.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.fileName}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.fileUrl}
                alt={selectedImage.fileName}
                className="w-full max-h-[60vh] object-contain"
              />
              <div className="flex justify-between text-sm text-slate-600">
                <span>Uploaded: {new Date(selectedImage.uploadedAt).toLocaleDateString()}</span>
                {selectedImage.fileSize && (
                  <span>Size: {(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                )}
              </div>
              <a
                href={selectedImage.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                View on Wikimedia Commons →
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
