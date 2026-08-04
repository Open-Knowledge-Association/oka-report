import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

interface DateRangeFilterProps {
  startDate?: Date;
  endDate?: Date;
  onChange: (range: { startDate?: Date; endDate?: Date }) => void;
}

export default function DateRangeFilter({ startDate, endDate, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-left font-normal">
            <Calendar className="mr-2 h-4 w-4" />
            {startDate ? format(startDate, "PPP") : "Start date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <CalendarComponent
            mode="single"
            selected={startDate}
            onSelect={(date) => onChange({ startDate: date, endDate })}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <span className="text-slate-500">to</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start text-left font-normal">
            <Calendar className="mr-2 h-4 w-4" />
            {endDate ? format(endDate, "PPP") : "End date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <CalendarComponent
            mode="single"
            selected={endDate}
            onSelect={(date) => onChange({ startDate, endDate: date })}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {(startDate || endDate) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ startDate: undefined, endDate: undefined })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
