"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@nzila/union-eyes-ui/button";
import { calendarEvents } from "@/lib/demo/cupe4373-demo";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type EventByDate = Map<string, typeof calendarEvents>;

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  });
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function Cupe4373CalendarGrid({ locale }: { locale: string }) {
  void locale;
  // Default to the month with the earliest event so the demo always lands on data
  const initial = useMemo(() => {
    if (calendarEvents.length === 0) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
    const earliest = calendarEvents
      .map((e) => new Date(e.date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return { year: earliest.getFullYear(), month: earliest.getMonth() };
  }, []);

  const [{ year, month }, setView] = useState(initial);

  const eventsByDate: EventByDate = useMemo(() => {
    const map: EventByDate = new Map();
    for (const e of calendarEvents) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, []);

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ key: string; date: Date | null }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ key: `pad-${i}`, date: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ key: toKey(date), date });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, date: null });
  }

  const goPrev = () =>
    setView(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  const goNext = () =>
    setView(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );

  const today = toKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{monthLabel(year, month)}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView(initial)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            {wd}
          </div>
        ))}
        {cells.map(({ key, date }) => {
          if (!date) {
            return <div key={key} className="min-h-[88px] bg-slate-50" />;
          }
          const k = toKey(date);
          const dayEvents = eventsByDate.get(k) ?? [];
          const isToday = k === today;
          return (
            <div
              key={key}
              className={`min-h-[88px] bg-white p-2 ${
                isToday ? "ring-2 ring-inset ring-blue-400" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    isToday ? "text-blue-700" : "text-slate-700"
                  }`}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {dayEvents.slice(0, 2).map((e) => (
                  <li
                    key={e.title}
                    title={`${e.time} — ${e.detail}`}
                    className="truncate rounded bg-blue-50 px-1.5 py-0.5 text-[11px] leading-tight text-blue-900"
                  >
                    {e.time} · {e.title}
                  </li>
                ))}
                {dayEvents.length > 2 && (
                  <li className="text-[10px] text-slate-500">+{dayEvents.length - 2} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
