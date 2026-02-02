import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEditor } from "@/lib/api";

export const Route = createFileRoute("/admin/editors/new")({
  component: AddEditorPage,
});

function AddEditorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");

  const mutation = useMutation({
    mutationFn: createEditor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["editors"] });
      navigate({ to: "/admin/editors" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      mutation.mutate({ username: username.trim() });
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-2xl">
      <Button variant="ghost" asChild className="mb-6">
        <a href="/admin/editors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Editors
        </a>
      </Button>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Add New Editor</h1>
        <p className="text-slate-600 mb-6">
          Add a Wikipedia editor to start tracking their contributions.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Wikipedia Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., Jimbo_Wales"
              className="max-w-md"
            />
            <p className="text-sm text-slate-500">
              Use underscores for spaces (e.g., "Jimbo_Wales" not "Jimbo Wales")
            </p>
          </div>

          {mutation.error && (
            <div className="text-red-600 text-sm">
              Failed to add editor. Please try again.
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/admin/editors" })}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!username.trim() || mutation.isPending}>
              {mutation.isPending ? "Adding..." : "Add Editor"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
