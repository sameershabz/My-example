"use client"

interface DeviceSelectorProps {
  devices: string[]
  selectedDevices: string[]
  setSelectedDevices: (devices: string[]) => void
}

export default function DeviceSelector({ devices, selectedDevices, setSelectedDevices }: DeviceSelectorProps) {
  const handleDeviceToggle = (device: string) => {
    setSelectedDevices((prev) => {
      if (device === "all") return ["all"]

      const next = prev.includes(device)
        ? prev.filter((d) => d !== device)
        : [...prev.filter((d) => d !== "all"), device]

      return next.length ? next : ["all"]
    })
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Devices</h2>

      <div className="flex flex-wrap gap-2">
        {["all", ...devices].map((device) => (
          <button
            key={device}
            onClick={() => handleDeviceToggle(device)}
            className={`px-3 py-2 rounded text-sm transition-colors ${
              selectedDevices.includes(device)
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
            }`}
          >
            {device === "all" ? "All Devices" : device}
          </button>
        ))}
      </div>
    </div>
  )
}
