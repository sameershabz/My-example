export interface DeviceData {
    deviceId: string;
    latitude: number;
    longitude: number;
    timestamp: string;  // ISO string
    efficiency: number; // e.g. 85
    soc: number;        // e.g. 72
  }
  
  // Example data with a few random devices
  export const sampleDevices: DeviceData[] = [
    {
      deviceId: "Bus-101",
      latitude: 40.7128,
      longitude: -74.006,
      timestamp: "2025-04-06T10:00:00Z",
      efficiency: 85,
      soc: 72,
    },
    {
      deviceId: "Bus-202",
      latitude: 34.0522,
      longitude: -118.2437,
      timestamp: "2025-04-06T11:30:00Z",
      efficiency: 92,
      soc: 50,
    },
    {
      deviceId: "Bus-303",
      latitude: 51.5074,
      longitude: -0.1278,
      timestamp: "2025-04-06T09:15:00Z",
      efficiency: 78,
      soc: 66,
    },
  ];
  