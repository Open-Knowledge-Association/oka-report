import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import type { WikiProjectStats } from "../../lib/queries";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const columns: ColumnDef<WikiProjectStats>[] = [
  {
    header: "Wiki Project",
    accessorKey: "wikiProject",
    cell: (info) => info.getValue(),
  },
  {
    header: "Edits",
    accessorKey: "edits",
    cell: (info) => formatNumber(info.getValue<number>()),
  },
  {
    header: "Words",
    accessorKey: "wordsAdded",
    cell: (info) => formatNumber(info.getValue<number>()),
  },
  {
    header: "Pageviews",
    accessorKey: "pageviews",
    cell: (info) => formatNumber(info.getValue<number>()),
  },
  {
    header: "Created",
    accessorKey: "articlesCreated",
    cell: (info) => formatNumber(info.getValue<number>()),
  },
  {
    header: "Modified",
    accessorKey: "articlesModified",
    cell: (info) => formatNumber(info.getValue<number>()),
  },
];

export default function WikiProjectTable({
  rows,
}: {
  rows: WikiProjectStats[];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "wordsAdded", desc: true },
  ]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 font-semibold"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
