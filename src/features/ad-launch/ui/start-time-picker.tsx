"use client";

import { useState } from "react";

/**
 * Date, hour, minute and AM/PM as separate controls.
 *
 * A native datetime-local input renders in the browser's own locale, so
 * whether it shows 13:00 or 1:00 PM is not the page's decision — and on a
 * Dutch-locale browser there is no AM/PM to be had. Splitting the parts makes
 * the choice explicit and the same everywhere.
 *
 * Emits the value the form already expects: "YYYY-MM-DDTHH:mm" in 24-hour
 * form, which is converted to a full ISO instant before it reaches Meta. The
 * display is 12-hour; what is sent never is.
 */
export function StartTimePicker({
  value,
  onChange,
}: {
  /** "YYYY-MM-DDTHH:mm", or empty. */
  value: string;
  onChange: (next: string) => void;
}) {
  const [date, setDate] = useState(() => value.slice(0, 10));
  const [hour24, setHour24] = useState(() =>
    value ? Number(value.slice(11, 13)) : 9,
  );
  const [minute, setMinute] = useState(() =>
    value ? Number(value.slice(14, 16)) : 0,
  );

  const meridiem = hour24 >= 12 ? "PM" : "AM";
  // 0 shows as 12 AM and 12 as 12 PM — the two cases a plain modulo gets wrong.
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const emit = (nextDate: string, nextHour24: number, nextMinute: number) => {
    if (!nextDate) return onChange("");
    const pad = (value: number) => String(value).padStart(2, "0");
    onChange(`${nextDate}T${pad(nextHour24)}:${pad(nextMinute)}`);
  };

  const setFromParts = (
    nextHour12: number,
    nextMeridiem: string,
    nextMinute: number,
  ) => {
    const base = nextHour12 % 12;
    const next24 = nextMeridiem === "PM" ? base + 12 : base;
    setHour24(next24);
    setMinute(nextMinute);
    emit(date, next24, nextMinute);
  };

  const selectClass =
    "h-9 rounded-md border border-border bg-transparent px-2 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(event) => {
          setDate(event.target.value);
          emit(event.target.value, hour24, minute);
        }}
        className={`${selectClass} flex-1`}
      />

      <select
        aria-label="Hour"
        value={hour12}
        onChange={(event) =>
          setFromParts(Number(event.target.value), meridiem, minute)
        }
        className={selectClass}
      >
        {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>

      <span className="text-sm text-muted-foreground">:</span>

      <select
        aria-label="Minute"
        value={minute}
        onChange={(event) =>
          setFromParts(hour12, meridiem, Number(event.target.value))
        }
        className={selectClass}
      >
        {/* Quarter hours: ad sets are not scheduled to the minute, and sixty
            options to scroll is worse than four that cover the real cases. */}
        {[0, 15, 30, 45].map((value) => (
          <option key={value} value={value}>
            {String(value).padStart(2, "0")}
          </option>
        ))}
      </select>

      <select
        aria-label="AM or PM"
        value={meridiem}
        onChange={(event) => setFromParts(hour12, event.target.value, minute)}
        className={selectClass}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>

      {date && (
        <button
          type="button"
          onClick={() => {
            setDate("");
            onChange("");
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
