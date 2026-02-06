import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, BookOpen, PenTool, Award, Upload, Star, type LucideIcon } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  achieved: boolean;
  achievedAt: string | null;
}

interface AchievementBadgesProps {
  editorId: string;
}

const badgeIcons: Record<string, LucideIcon> = {
  first_article: FileText,
  prolific_writer: BookOpen,
  wordsmith: PenTool,
  reference_master: Award,
  wiki_contributor: Star,
  commons_contributor: Upload,
  veteran: Award,
};

export function AchievementBadges({ editorId }: AchievementBadgesProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["editor", "achievements", editorId],
    queryFn: async () => {
      const response = await fetch(`/api/editors/${editorId}/achievements`);
      if (!response.ok) {
        throw new Error("Failed to fetch achievements");
      }
      const result = await response.json();
      return result.data as Badge[];
    },
  });

  if (isLoading) {
    return (
      <div data-testid="achievement-badges-loading" className="flex flex-wrap gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-16 h-16 bg-slate-200 animate-pulse rounded-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        data-testid="achievement-badges-empty"
        className="py-8 text-center bg-slate-50 rounded border border-slate-200"
      >
        <p className="text-slate-500">No achievements yet. Keep editing!</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div data-testid="achievement-badges" className="flex flex-wrap gap-4">
        {data.map((badge) => {
          const Icon = badgeIcons[badge.id] || Star;
          return (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div
                  className={`
                    relative w-16 h-16 rounded-full flex items-center justify-center
                    transition-all duration-300 cursor-help
                    ${
                      badge.achieved
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-100"
                        : "bg-slate-200 text-slate-400 grayscale"
                    }
                    ${badge.achieved ? "hover:scale-110" : ""}
                  `}
                >
                  <Icon className="w-8 h-8" />
                  {badge.achieved && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs">
                      ✓
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="text-center">
                  <p className="font-semibold">{badge.name}</p>
                  <p className="text-sm text-slate-600">{badge.description}</p>
                  {badge.achievedAt && (
                    <p className="text-xs text-slate-500 mt-1">
                      Earned: {new Date(badge.achievedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
