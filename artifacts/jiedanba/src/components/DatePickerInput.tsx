import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid, startOfMonth } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";

interface DatePickerInputProps {
  value: string;        // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;         // YYYY-MM-DD
  placeholder?: string;
  error?: boolean;
}

export function DatePickerInput({
  value,
  onChange,
  min,
  placeholder = "请选择日期",
  error,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const validSelected = selected && isValid(selected) ? selected : undefined;
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;

  const close = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [close]);

  const displayText = validSelected
    ? format(validSelected, "yyyy年M月d日", { locale: zhCN })
    : "";

  const today = new Date();
  const startYear = today.getFullYear();
  const endYear = startYear + 5;

  return (
    <div ref={ref} className="relative">
      {/* 触发按钮 — 与 CustomSelect 完全一致的样式 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm bg-white outline-none transition-all
          ${open
            ? "ring-2 ring-primary/20 border-primary"
            : error
              ? "border-red-400"
              : "border-slate-200 hover:border-slate-300"
          }
        `}
      >
        <span className={`flex items-center gap-2 ${displayText ? "text-slate-800" : "text-slate-400"}`}>
          <CalendarDays size={14} className="shrink-0 text-slate-400" />
          {displayText || placeholder}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* 日历浮层 */}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <DayPicker
            mode="single"
            selected={validSelected}
            defaultMonth={validSelected ?? (minDate && minDate > today ? minDate : today)}
            onSelect={day => {
              if (day) {
                onChange(format(day, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            disabled={minDate ? { before: minDate } : undefined}
            locale={zhCN}
            captionLayout="dropdown"
            startMonth={startOfMonth(minDate ?? today)}
            endMonth={new Date(endYear, 11, 1)}
            classNames={{
              root: "p-3 select-none",
              month_caption: "flex items-center justify-between mb-2 gap-1",
              dropdowns: "flex items-center gap-1",
              dropdown: "text-sm font-bold text-slate-800 border-0 outline-none bg-transparent cursor-pointer hover:text-primary py-0",
              dropdown_root: "relative",
              nav: "flex items-center gap-1",
              button_previous: "w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors",
              button_next:    "w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors",
              weeks: "",
              weekdays: "flex mb-1",
              weekday: "flex-1 text-center text-[11px] font-semibold text-slate-400 w-8",
              week: "flex",
              day: "flex-1 flex items-center justify-center",
              day_button: [
                "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-primary/10 hover:text-primary",
                "focus:outline-none",
              ].join(" "),
              selected: "!bg-primary !text-white rounded-lg",
              today: "font-extrabold text-primary",
              outside: "opacity-30",
              disabled: "opacity-25 cursor-not-allowed hover:!bg-transparent hover:!text-inherit",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  );
}
