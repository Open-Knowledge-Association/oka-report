import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { bulkImportEditors } from "@/lib/api";

export const Route = createFileRoute("/admin/editors/import")({
  component: BulkImportPage,
});

function BulkImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [usernames, setUsernames] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const list = usernames
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      return bulkImportEditors(list);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editors"] });
      navigate({ to: "/admin/editors" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Button variant="ghost" asChild className="mb-6">
        <a href="/admin/editors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Editors
        </a>
      </Button>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Bulk Import Editors</h1>
        <p className="text-slate-600 mb-6">
          Import multiple editors at once. Enter one username per line.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="usernames">Usernames (one per line)</Label>
            <Textarea
              id="usernames"
              value={usernames}
              onChange={(e) => setUsernames(e.target.value)}
              placeholder="Jimbo_Wales&#10;Example_User&#10;Another_Editor"
              rows={10}
              className="font-mono"
            />
            <p className="text-sm text-slate-500">
              {usernames.split("\n").filter((u) => u.trim()).length} editor(s) to import
            </p>
          </div>

          {mutation.error && (
            <div className="text-red-600 text-sm">Failed to import editors. Please try again.</div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/admin/editors" })}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                usernames.split("\n").filter((u) => u.trim()).length === 0 || mutation.isPending
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Importing..." : "Import Editors"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
