"use client"

type DateRangePickerProps = {
  readonly value: number
  readonly onChange: (days: number) => void
}

const RANGES = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="inline-flex rounded-lg border bg-white p-1">
      {RANGES.map((range) => (
        <button
          key={range.days}
          type="button"
          onClick={() => onChange(range.days)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === range.days
              ? "bg-[#1E40AF] text-white shadow-sm"
              : "text-muted-foreground hover:bg-gray-100"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
