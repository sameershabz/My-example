"use client"

interface FieldSelectorProps {
  fields: string[]
  selectedFields: string[]
  setSelectedFields: (fields: string[]) => void
}

export default function FieldSelector({ fields, selectedFields, setSelectedFields }: FieldSelectorProps) {
  const fieldCategories = {
    Location: ["lat", "lon", "alt_m", "heading_deg"],
    Speed: ["speed_kmh", "speed"],
    Power: ["voltage_v", "power_kw", "efficiency"],
    Battery: ["soc"],
    Sensors: ["temperature_c", "signal_strength_dbm"],
    Acceleration: ["accel_x", "accel_y", "accel_z"],
    Quality: ["quality_min", "quality_avg"],
    Current: ["min", "avg", "max"],
  }

  const getCategoryForField = (field: string): string => {
    for (const [category, categoryFields] of Object.entries(fieldCategories)) {
      if (categoryFields.includes(field)) {
        return category
      }
    }
    return "Other"
  }

  // Group fields by category
  const fieldsByCategory: Record<string, string[]> = {}
  fields.forEach((field) => {
    const category = getCategoryForField(field)
    if (!fieldsByCategory[category]) {
      fieldsByCategory[category] = []
    }
    fieldsByCategory[category].push(field)
  })

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Data Fields</h2>

      {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
        <div key={category} className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{category}</h3>
          <div className="flex flex-wrap gap-2">
            {categoryFields.map((field) => (
              <button
                key={field}
                onClick={() =>
                  setSelectedFields((prev) =>
                    prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
                  )
                }
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  selectedFields.includes(field)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {field}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
