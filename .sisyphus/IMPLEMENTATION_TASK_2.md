# Task 2: Update editors.tsx to use local API and internal links

## Changes Needed

### File: `apps/web/src/routes/editors.tsx`

#### Step 1: Replace lines 13-27 with new types and fetch function

```typescript
// Remove this import:
// import { fetchOutreachUsers, type OutreachUser } from "@/lib/api";

// Add this interface
type EditorWithStats = {
  id: string;
  username: string;
  characterSum: number;
  referencesCount: number;
  uploadsCount: number;
};

type StatsTotals = {
  characters: number;
  references: number;
  uploads: number;
};

// Add fetch function
async function fetchEditors(): Promise<EditorWithStats[]> {
  const response = await fetch("/api/editors");
  if (!response.ok) {
    throw new Error("Failed to fetch editors");
  }
  const result = await response.json();
  return result.data;
}
```

#### Step 2: Replace lines 33-49 (useQuery and data transformation)

```typescript
function EditorsStatsPage() {
  const { data: editors = [], isLoading } = useQuery({
    queryKey: ["editors"],
    queryFn: fetchEditors,
  });

  const totalStats = editors.reduce<StatsTotals>(
    (acc, editor) => ({
      characters: acc.characters + (editor.characterSum || 0),
      references: acc.references + (editor.referencesCount || 0),
      uploads: acc.uploads + (editor.uploadsCount || 0),
    }),
    { characters: 0, references: 0, uploads: 0 },
  );
```

#### Step 3: Update loading text (line 65-67)

```typescript
<p className="text-slate-600 mt-1">
  {isLoading
    ? "Loading editors..."
    : `Stats for ${editors.length} OKA editors`}
</p>
```

#### Step 4: Replace lines 136-144 (username link)

```typescript
<TableCell className="font-medium">
  <Link
    to={`/editors/${editor.id}`}
    className="hover:underline text-blue-600"
  >
    {editor.username}
  </Link>
</TableCell>
```

#### Step 5: Update error message (line 130)

```typescript
<TableCell colSpan={4} className="text-center py-8 text-slate-500">
  No editors found.
</TableCell>
```

## Complete File After Changes

```typescript
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, BookOpen, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EditorWithStats = {
  id: string;
  username: string;
  characterSum: number;
  referencesCount: number;
  uploadsCount: number;
};

type StatsTotals = {
  characters: number;
  references: number;
  uploads: number;
};

async function fetchEditors(): Promise<EditorWithStats[]> {
  const response = await fetch('/api/editors');
  if (!response.ok) {
    throw new Error('Failed to fetch editors');
  }
  const result = await response.json();
  return result.data;
}

export const Route = createFileRoute("/editors")({
  component: EditorsStatsPage,
});

function EditorsStatsPage() {
  const { data: editors = [], isLoading } = useQuery({
    queryKey: ["editors"],
    queryFn: fetchEditors,
  });

  const totalStats = editors.reduce<StatsTotals>(
    (acc, editor) => ({
      characters: acc.characters + (editor.characterSum || 0),
      references: acc.references + (editor.referencesCount || 0),
      uploads: acc.uploads + (editor.uploadsCount || 0),
    }),
    { characters: 0, references: 0, uploads: 0 },
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Editor Statistics</h1>
        <p className="text-slate-600 mt-1">
          {isLoading
            ? "Loading editors..."
            : `Stats for ${editors.length} OKA editors`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Editors</CardTitle>
            <Users className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{editors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Characters Added</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.characters.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">References Added</CardTitle>
            <BookOpen className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.references.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
            <HardDrive className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.uploads.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead className="text-right">Characters Added</TableHead>
              <TableHead className="text-right">References Added</TableHead>
              <TableHead className="text-right">Total Uploads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : editors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  No editors found.
                </TableCell>
              </TableRow>
            ) : (
              editors.map((editor) => (
                <TableRow key={editor.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/editors/${editor.id}`}
                      className="hover:underline text-blue-600"
                    >
                      {editor.username}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.characterSum.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.referencesCount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {editor.uploadsCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

## Verification

After making changes:

```bash
# Restart dev server
moon run :dev

# Test in browser:
# 1. Navigate to http://localhost:3001/editors
# 2. Click on any username
# 3. Should navigate to /editors/{id} (internal navigation, no page reload)
# 4. Profile page should load with charts and stats
```

## Commit

```bash
git add apps/web/src/routes/editors.tsx
git commit -m "feat(web): update editors page to use local API with internal links"
```
