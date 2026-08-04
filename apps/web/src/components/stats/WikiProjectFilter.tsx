import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WikiProjectFilterProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: string[];
}

export default function WikiProjectFilter({ value, onChange, options }: WikiProjectFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-slate-500" />
      <Select
        value={value || "all"}
        onValueChange={(val) => onChange(val === "all" ? undefined : val)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All wiki projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All wiki projects</SelectItem>
          {options.map((project) => (
            <SelectItem key={project} value={project}>
              {project}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
