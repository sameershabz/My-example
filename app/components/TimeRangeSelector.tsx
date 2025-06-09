"use client"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

export type TimeRange = "24hr" | "7d" | "1m" | "1y" | "all" | "custom"

interface TimeRangeSelectorProps {
  timeRange: TimeRange
  setTimeRange: (range: TimeRange) => void
  startDate: Date | null
  setStartDate: (date: Date | null) => void
  endDate: Date | null
  setEndDate: (date: Date | null) => void
}

export default function TimeRangeSelector({
  timeRange,
  setTimeRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: TimeRangeSelectorProps) {
  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: "24 Hours", value: "24hr" },
    { label: "7 Days", value: "7d" },
    { label: "1 Month", value: "1m" },
    { label: "1 Year", value: "1y" },
    { label: "All Time", value: "all" },
    { label: "Custom", value: "custom" },
  ]

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Time Range</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        {timeRanges.map((r) => (
          <button
            key={r.value}
            onClick={() => setTimeRange(r.value)}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              timeRange === r.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {timeRange === "custom" && (
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <DatePicker
              selected={startDate}
              onChange={(d) => {
                setStartDate(d)
                setTimeRange("custom")
              }}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              showTimeSelect
              dateFormat="Pp"
              placeholderText="Select start date"
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <DatePicker
              selected={endDate}
              onChange={(d) => {
                setEndDate(d)
                setTimeRange("custom")
              }}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate || undefined}
              showTimeSelect
              dateFormat="Pp"
              placeholderText="Select end date"
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate(null)
                setEndDate(null)
                setTimeRange("all")
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
