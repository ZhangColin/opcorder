import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerInputProps {
  value: string;           // YYYY-MM-DD
  onChange: (v: string) => void;
  min?: string;            // YYYY-MM-DD
  placeholder?: string;
  className?: string;
}

export function DatePickerInput({
  value,
  onChange,
  min,
  placeholder = "请选择日期",
  className = "",
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const validSelected = selected && isValid(selected) ? selected : undefined;

  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const displayText = validSelected
    ? format(validSelected, "yyyy年M月d日", { locale: zhCN })
    : "";

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`
          w-full flex items-center gap-2 border rounded-xl px-3 py-2.5 text-sm bg-white
          transition-all outline-none
          ${open
            ? "border-primary ring-2 ring-primary/20"
            : "border-slate-200 hover:border-slate-300"
          }
          ${displayText ? "text-slate-800" : "text-slate-400"}
        `}
      >
        <CalendarDays size={15} className={open ? "text-primary" : "text-slate-400"} />
        <span className="flex-1 text-left">{displayText || placeholder}</span>
        {displayText && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(""); }}
            onKeyDown={e => e.key === "Enter" && onChange("")}
            className="text-slate-300 hover:text-slate-500 text-xs leading-none px-0.5"
          >
            ✕
          </span>
        )}
      </button>

      {/* 日历弹层 */}
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden min-w-[280px]">
          <DayPicker
            mode="single"
            selected={validSelected}
            onSelect={day => {
              if (day) {
                onChange(format(day, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            disabled={minDate ? { before: minDate } : undefined}
            locale={zhCN}
            formatters={{
              formatCaption: (date) =>
                format(date, "yyyy年 M月", { locale: zhCN }),
            }}
            classNames={{
              root: "p-3",
              month_caption: "flex items-center justify-center relative h-8 mb-2",
              caption_label: "text-sm font-bold text-slate-800",
              nav: "flex items-center gap-1",
              button_previous:
                "absolute left-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors",
              button_next:
                "absolute right-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors",
              weeks: "mt-1",
              weekdays: "flex mb-1",
              weekday:
                "flex-1 text-center text-[11px] font-semibold text-slate-400 pb-1",
              week: "flex",
              day: "flex-1 flex items-center justify-center",
              day_button: `
                w-8 h-8 rounded-lg text-sm font-medium transition-colors
                hover:bg-primary/10 hover:text-primary
                focus:outline-none focus:ring-2 focus:ring-primary/20
              `,
              selected:
                "bg-primary! text-white! rounded-lg! hover:bg-primary/90!",
              today: "font-bold text-primary",
              outside: "opacity-30",
              disabled: "opacity-25 cursor-not-allowed hover:bg-transparent hover:text-inherit",
              hidden: "invisible",
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left"
                  ? <ChevronLeft size={14} />
                  : <ChevronRight size={14} />,
            }}
          />
        </div>
      )}
    </div>
  );
}
