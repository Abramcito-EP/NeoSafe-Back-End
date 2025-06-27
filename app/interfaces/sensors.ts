export interface TemperatureSensor {
  boxId: number
  temperature: number
  createdAt: Date
}

export interface HumiditySensor {
  boxId: number
  humidity: number
  createdAt: Date
}

export interface WeightSensor {
  boxId: number
  weight: number
  createdAt: Date
}

export interface SensorsDataUpdate {
  temperature: {
    value: number
    timestamp: Date
  } | null
  humidity: {
    value: number
    timestamp: Date
  } | null
  weight: {
    value: number
    timestamp: Date
  } | null
}