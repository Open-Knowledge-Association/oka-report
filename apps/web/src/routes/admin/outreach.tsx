import { useQuery } from "@tanstack/react-query";
import { OutreachStats, SyncButton, SyncStatusCard } from "@/components/outreach";
import { useToast } from "@/hooks/use-toast";

export default function OutreachAdminPage() {
  const { toast } = useToast();

  const {
    data: courseData,
    isLoading: isLoadingCourse,
    refetch: refetchCourse,
  } = useQuery({
    queryKey: ["outreach-course"],
    queryFn: async () => {
      const response = await fetch("/api/outreach/course?school=OKA&slug=OKA");
      if (!response.ok) {
        throw new Error("Failed to fetch course data");
      }
      return response.json();
    },
  });

  const { data: editorsData, refetch: refetchEditors } = useQuery({
    queryKey: ["outreach-editors"],
    queryFn: async () => {
      const response = await fetch("/api/editors?source=outreach_dashboard");
      if (!response.ok) {
        throw new Error("Failed to fetch editors");
      }
      return response.json();
    },
  });

  const handleSyncComplete = () => {
    setTimeout(() => {
      refetchCourse();
      refetchEditors();
      toast({
        title: "Sync Complete",
        description: "Editor data has been refreshed.",
      });
    }, 2000);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Outreach Dashboard Integration</h1>
        <p className="text-muted-foreground mt-2">
          Manage synchronization with the Wikimedia Outreach Dashboard for OKA course.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <OutreachStats course={courseData?.data?.course} />
        <SyncStatusCard
          lastSyncAt={undefined}
          editorCount={editorsData?.data?.length || 0}
          isSyncing={isLoadingCourse}
        />
      </div>

      <div className="mt-8">
        <SyncButton school="OKA" slug="OKA" onSyncComplete={handleSyncComplete} />
      </div>

      <div className="mt-8 rounded-lg border bg-muted/50 p-4">
        <h3 className="font-semibold mb-2">About This Integration</h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Course URL: https://outreachdashboard.wmflabs.org/courses/OKA/OKA/</li>
          <li>Course ID: 33560</li>
          <li>Sync imports editors from the Outreach Dashboard</li>
          <li>Usernames are normalized (spaces → underscores)</li>
          <li>Removed editors are marked as inactive, not deleted</li>
        </ul>
      </div>
    </div>
  );
}
