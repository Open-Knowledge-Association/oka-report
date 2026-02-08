import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon } from "lucide-react";

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
  const [imageError, setImageError] = useState<Record<string, boolean>>({});

  const handleImageError = (fileName: string) => {
    setImageError((prev) => ({ ...prev, [fileName]: true }));
  };

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
        className="py-12 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed"
      >
        <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
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
        {data.map((upload) => {
          const isError = imageError[upload.fileName];
          const displayUrl = !isError && upload.thumbnailUrl ? upload.thumbnailUrl : upload.fileUrl;

          return (
            <div
              key={upload.fileName}
              className="group relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all border border-slate-200"
              onClick={() => setSelectedImage(upload)}
            >
              <img
                src={displayUrl}
                alt={upload.fileName}
                className={`w-full h-full object-cover transition-opacity ${isError ? "opacity-50" : "opacity-100"}`}
                loading="lazy"
                onError={() => handleImageError(upload.fileName)}
              />
              {isError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-slate-400" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate font-medium">{upload.fileName}</p>
                <p className="text-white/80 text-[10px]">
                  {new Date(upload.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-slate-800">
          <div className="relative flex items-center justify-center h-[80vh]">
            {selectedImage && (
              <img
                src={selectedImage.fileUrl}
                alt={selectedImage.fileName}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
          {selectedImage && (
            <div className="p-4 bg-white border-t border-slate-200">
              <DialogHeader>
                <DialogTitle className="text-base truncate">{selectedImage.fileName}</DialogTitle>
              </DialogHeader>
              <div className="flex justify-between items-center mt-2 text-sm text-slate-600">
                <div className="flex gap-4">
                  <span>Uploaded: {new Date(selectedImage.uploadedAt).toLocaleDateString()}</span>
                  {selectedImage.fileSize && (
                    <span>Size: {(selectedImage.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                </div>
                <a
                  href={selectedImage.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-medium"
                >
                  View Original →
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
