import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users } from "lucide-react";

interface SyncStatusCardProps {
  lastSyncAt?: string;
  editorCount?: number;
  isSyncing?: boolean;
}

export function SyncStatusCard({ lastSyncAt, editorCount, isSyncing }: SyncStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sync Status
          {isSyncing && (
            <Badge variant="secondary" className="animate-pulse">
              Syncing...
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Outreach Dashboard synchronization status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Last Sync:</span>
          <span>{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Imported Editors:</span>
          <span className="font-medium">{editorCount ?? 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}
