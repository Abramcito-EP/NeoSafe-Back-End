import { HttpContext } from '@adonisjs/core/http'
import MongoClient from '#services/mongo_client'

interface TemperatureSensor {
  boxId: number
  temperature: number
  createdAt: Date
}

interface HumiditySensor {
  boxId: number
  humidity: number
  createdAt: Date
}

interface WeightSensor {
  boxId: number
  weight: number
  createdAt: Date
}

export default class SensorsController {
  async getLatestData({ response }: HttpContext) {
    try {
      // Conectar a MongoDB si aún no lo está
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      const boxId = 1 // ID fijo para la simulación

      const latestTemperature = await MongoClient.collection<TemperatureSensor>('temperature_sensors')
        .find({ boxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      const latestHumidity = await MongoClient.collection<HumiditySensor>('humidity_sensors')
        .find({ boxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      const latestWeight = await MongoClient.collection<WeightSensor>('weight_sensors')
        .find({ boxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      return response.ok({
        temperature: latestTemperature.length > 0 ? {
          value: latestTemperature[0].temperature,
          timestamp: latestTemperature[0].createdAt
        } : null,
        humidity: latestHumidity.length > 0 ? {
          value: latestHumidity[0].humidity,
          timestamp: latestHumidity[0].createdAt
        } : null,
        weight: latestWeight.length > 0 ? {
          value: latestWeight[0].weight,
          timestamp: latestWeight[0].createdAt
        } : null
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener datos de sensores',
        error: error.message
      })
    }
  }

  async getHistoricalData({ request, response }: HttpContext) {
    try {
      // Conectar a MongoDB si aún no lo está
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      const { sensor, hours = 24 } = request.qs()
      const boxId = 1 // ID fijo para la simulación
      
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours))

      let data = []

      switch (sensor) {
        case 'temperature':
          data = await MongoClient.collection<TemperatureSensor>('temperature_sensors')
            .find({ 
              boxId,
              createdAt: { $gte: hoursAgo }
            })
            .sort({ createdAt: 1 })
            .toArray()
          break
        case 'humidity':
          data = await MongoClient.collection<HumiditySensor>('humidity_sensors')
            .find({ 
              boxId,
              createdAt: { $gte: hoursAgo }
            })
            .sort({ createdAt: 1 })
            .toArray()
          break
        case 'weight':
          data = await MongoClient.collection<WeightSensor>('weight_sensors')
            .find({ 
              boxId,
              createdAt: { $gte: hoursAgo }
            })
            .sort({ createdAt: 1 })
            .toArray()
          break
        default:
          return response.badRequest({
            message: 'Tipo de sensor no válido'
          })
      }

      return response.ok(data)
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener datos históricos',
        error: error.message
      })
    }
  }
}