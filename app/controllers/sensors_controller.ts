import { HttpContext } from '@adonisjs/core/http'
import MongoClient from '#services/mongo_client'
import SafeBox from '#models/safe_box'

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
  async getLatestData({ request, auth, response }: HttpContext) {
    try {
      const { boxId } = request.qs();
      const user = auth.user!
      await user.load('role')
      
      // Verificar permisos para acceder a la caja específica
      if (boxId) {
        const box = await SafeBox.findOrFail(boxId);
        
        if (user.role.name === 'user' && box.ownerId !== user.id) {
          return response.forbidden({ message: 'No tienes permiso para acceder a los datos de esta caja' });
        }
        
        if (user.role.name === 'provider' && box.providerId !== user.id) {
          return response.forbidden({ message: 'No eres el proveedor de esta caja' });
        }
      }
      
      // Conectar a MongoDB si aún no lo está
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      // Si no se especifica boxId, usar boxId 1 (comportamiento anterior para compatibilidad)
      const targetBoxId = boxId ? parseInt(boxId) : 1;

      const latestTemperature = await MongoClient.collection<TemperatureSensor>('temperature_sensors')
        .find({ boxId: targetBoxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      const latestHumidity = await MongoClient.collection<HumiditySensor>('humidity_sensors')
        .find({ boxId: targetBoxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      const latestWeight = await MongoClient.collection<WeightSensor>('weight_sensors')
        .find({ boxId: targetBoxId })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray()

      return response.ok({
        boxId: targetBoxId,
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

  async getHistoricalData({ request, auth, response }: HttpContext) {
    try {
      const { sensor, hours = 24, boxId } = request.qs();
      const user = auth.user!
      await user.load('role')
      
      // Verificar permisos para acceder a la caja específica
      if (boxId) {
        const box = await SafeBox.findOrFail(boxId);
        
        if (user.role.name === 'user' && box.ownerId !== user.id) {
          return response.forbidden({ message: 'No tienes permiso para acceder a los datos de esta caja' });
        }
        
        if (user.role.name === 'provider' && box.providerId !== user.id) {
          return response.forbidden({ message: 'No eres el proveedor de esta caja' });
        }
      }
      
      // Conectar a MongoDB si aún no lo está
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      // Si no se especifica boxId, usar boxId 1 (comportamiento anterior para compatibilidad)
      const targetBoxId = boxId ? parseInt(boxId) : 1;
      
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours))

      let data = []

      switch (sensor) {
        case 'temperature':
          data = await MongoClient.collection<TemperatureSensor>('temperature_sensors')
            .find({ 
              boxId: targetBoxId,
              createdAt: { $gte: hoursAgo }
            })
            .sort({ createdAt: 1 })
            .toArray()
          break
        case 'humidity':
          data = await MongoClient.collection<HumiditySensor>('humidity_sensors')
            .find({ 
              boxId: targetBoxId,
              createdAt: { $gte: hoursAgo }
            })
            .sort({ createdAt: 1 })
            .toArray()
          break
        case 'weight':
          data = await MongoClient.collection<WeightSensor>('weight_sensors')
            .find({ 
              boxId: targetBoxId,
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

      return response.ok({
        boxId: targetBoxId,
        sensor,
        data
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener datos históricos',
        error: error.message
      })
    }
  }
}