import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface OutreachStatsProps {
  course?: {
    id: number;
    title: string;
    school: string;
    slug: string;
    student_count: number;
    edit_count: string;
    article_count: number;
    word_count: string;
    view_count: string;
  };
}

export function OutreachStats({ course }: OutreachStatsProps) {
  if (!course) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outreach Dashboard</CardTitle>
          <CardDescription>Loading course statistics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const courseUrl = `https://outreachdashboard.wmflabs.org/courses/${course.school}/${course.slug}/`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {course.title}
              <Badge variant="outline">ID: {course.id}</Badge>
            </CardTitle>
            <CardDescription>
              <a
                href={courseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                View on Outreach Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{course.student_count}</p>
            <p className="text-xs text-muted-foreground">Editors</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{course.edit_count}</p>
            <p className="text-xs text-muted-foreground">Edits</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{course.article_count.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Articles</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold">{course.word_count}</p>
            <p className="text-xs text-muted-foreground">Words</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
