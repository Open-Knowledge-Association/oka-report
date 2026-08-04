import { TrendingUp } from "lucide-react";
import type { OverallStats } from "../../lib/queries";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const cards = [
  { key: "edits", label: "Edits" },
  { key: "wordsAdded", label: "Words Added" },
  { key: "pageviews", label: "Pageviews" },
  { key: "articlesCreated", label: "Articles Created" },
] as const;

type CardKey = (typeof cards)[number]["key"];

export default function StatsCards({ totals }: { totals: OverallStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{card.label}</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {formatNumber(totals[card.key as CardKey])}
          </div>
        </div>
      ))}
    </div>
  );
}
