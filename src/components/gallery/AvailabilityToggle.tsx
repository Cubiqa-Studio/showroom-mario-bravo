"use client";

import { STATUS_ORDER, STATUS_STYLES } from "@/lib/status";

interface AvailabilityToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

/** Global switch: paint every unit by its status color permanently, plus legend. */
export function AvailabilityToggle({ value, onChange }: AvailabilityToggleProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-gold/50"
      >
        <span
          className={`relative h-5 w-9 rounded-full transition-colors ${
            value ? "bg-gold" : "bg-stone-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
              value ? "left-4" : "left-0.5"
            }`}
          />
        </span>
        Disponibilidad
      </button>

      <ul className="flex items-center gap-3 text-xs text-muted">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: STATUS_STYLES[s].color }}
            />
            {STATUS_STYLES[s].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
