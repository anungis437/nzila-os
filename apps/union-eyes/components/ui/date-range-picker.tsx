/**
 * Date Range Picker Component
 * 
 * Production-ready date range selector with:
 * - Preset ranges (Today, Last 7 days, Last 30 days, etc.)
 * - Custom range selection
 * - Keyboard navigation
 * - Accessibility
 * - Responsive design
 * 
 * @module components/ui/date-range-picker
 */

"use client";

import * as React from "react";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DateRangePreset {
  label: string;
  range: DateRange;
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  presets?: DateRangePreset[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const defaultPresets: DateRangePreset[] = [
  {
    label: "Today",
    range: {
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "Yesterday",
    range: {
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    },
  },
  {
    label: "Last 7 days",
    range: {
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "Last 14 days",
    range: {
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "Last 30 days",
    range: {
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "Last 90 days",
    range: {
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "This month",
    range: {
      from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      to: endOfDay(new Date()),
    },
  },
  {
    label: "Last month",
    range: {
      from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
      to: endOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0)),
    },
  },
  {
    label: "This year",
    range: {
      from: startOfDay(new Date(new Date().getFullYear(), 0, 1)),
      to: endOfDay(new Date()),
    },
  },
];

export function DateRangePicker({
  value,
  onChange,
  presets = defaultPresets,
  placeholder = "Select date range",
  className,
  disabled = false,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(value);
  const [selectedPreset, setSelectedPreset] = React.useState<string>("");

  React.useEffect(() => {
    setDate(value);
  }, [value]);

  const handleDateChange = (newDate: DateRange | undefined) => {
    setDate(newDate);
    onChange?.(newDate);
    setSelectedPreset("");
  };

  const handlePresetChange = (presetLabel: string) => {
    const preset = presets.find((p) => p.label === presetLabel);
    if (preset) {
      setDate(preset.range);
      onChange?.(preset.range);
      setSelectedPreset(presetLabel);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            <div className="border-r p-4 space-y-1 min-w-[140px]">
              <div className="text-sm font-medium mb-2">Presets</div>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset.label} value={preset.label}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="pt-2 space-y-1">
                {presets.slice(0, 6).map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start font-normal"
                    onClick={() => handlePresetChange(preset.label)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="p-4">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleDateChange}
                numberOfMonths={2}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

