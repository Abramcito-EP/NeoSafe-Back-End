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

  // Método específico para polling con datos dinámicos
  async getPollingData({ auth, response }: HttpContext) {
    try {
      await auth.user! // Solo verificar que esté autenticado
      const targetBoxId = 1;
      
      // Conectar a MongoDB
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      const now = new Date();
      
      // Generar nuevos datos para simular lecturas en tiempo real
      console.log('📊 Generando nuevos datos de sensores para polling...');
      
      // Generar nuevos valores realistas
      const newTemperature = parseFloat((Math.random() * 10 + 20).toFixed(1)); // 20-30°C
      const newHumidity = parseFloat((Math.random() * 30 + 45).toFixed(1)); // 45-75%
      const newWeight = parseFloat((Math.random() * 2 + 1.5).toFixed(2)); // 1.5-3.5kg
      
      // Insertar nuevos datos en MongoDB
      await Promise.all([
        MongoClient.collection('temperature_sensors').insertOne({
          boxId: targetBoxId,
          temperature: newTemperature,
          createdAt: now
        }),
        
        MongoClient.collection('humidity_sensors').insertOne({
          boxId: targetBoxId,
          humidity: newHumidity,
          createdAt: now
        }),
        
        MongoClient.collection('weight_sensors').insertOne({
          boxId: targetBoxId,
          weight: newWeight,
          createdAt: now
        })
      ]);

      // Preparar respuesta con los nuevos datos
      const sensorData = {
        boxId: targetBoxId,
        timestamp: now.toISOString(),
        sensors: {
          temperature: {
            value: newTemperature,
            unit: "°C",
            timestamp: now.toISOString()
          },
          humidity: {
            value: newHumidity,
            unit: "%",
            timestamp: now.toISOString()
          },
          weight: {
            value: newWeight,
            unit: "kg",
            timestamp: now.toISOString()
          }
        }
      };

      console.log(`📡 Enviando datos: Temp: ${newTemperature}°C, Humedad: ${newHumidity}%, Peso: ${newWeight}kg`);
      
      return response.ok(sensorData);

    } catch (error) {
      console.error('❌ Error en polling de sensores:', error);
      
      // Fallback con datos simulados si hay error
      const now = new Date().toISOString();
      const fallbackData = {
        boxId: 1,
        timestamp: now,
        sensors: {
          temperature: {
            value: parseFloat((Math.random() * 10 + 20).toFixed(1)),
            unit: "°C",
            timestamp: now
          },
          humidity: {
            value: parseFloat((Math.random() * 30 + 45).toFixed(1)),
            unit: "%",
            timestamp: now
          },
          weight: {
            value: parseFloat((Math.random() * 2 + 1.5).toFixed(2)),
            unit: "kg",
            timestamp: now
          }
        }
      };
      
      console.log('⚠️ Usando datos de fallback debido a error');
      return response.ok(fallbackData);
    }
  }

  // Método adicional para generar datos de prueba (opcional)
  async generateTestData({ auth, response }: HttpContext) {
    try {
      await auth.user! // Verificar autenticación
      const targetBoxId = 1;
      
      // Conectar a MongoDB
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      // Generar datos de prueba para los últimos 60 minutos
      const now = new Date();
      const dataPoints = 60; // 60 puntos de datos (1 por minuto)

      console.log(`🧪 Generando ${dataPoints} puntos de datos de prueba...`);

      for (let i = 0; i < dataPoints; i++) {
        const timestamp = new Date(now.getTime() - (i * 60000)); // Cada minuto hacia atrás

        // Datos de temperatura (20-35°C con variación)
        await MongoClient.collection('temperature_sensors').insertOne({
          boxId: targetBoxId,
          temperature: parseFloat((Math.random() * 15 + 20).toFixed(1)),
          createdAt: timestamp
        });

        // Datos de humedad (30-80% con variación)
        await MongoClient.collection('humidity_sensors').insertOne({
          boxId: targetBoxId,
          humidity: parseFloat((Math.random() * 50 + 30).toFixed(1)),
          createdAt: timestamp
        });

        // Datos de peso (1-5kg con variación)
        await MongoClient.collection('weight_sensors').insertOne({
          boxId: targetBoxId,
          weight: parseFloat((Math.random() * 4 + 1).toFixed(2)),
          createdAt: timestamp
        });
      }

      console.log(`✅ Generados ${dataPoints} puntos de datos de prueba para boxId: ${targetBoxId}`);

      return response.ok({
        message: `Datos de prueba generados exitosamente para boxId: ${targetBoxId}`,
        dataPoints: dataPoints,
        timeRange: '60 minutos'
      });

    } catch (error) {
      console.error('❌ Error generando datos de prueba:', error);
      return response.internalServerError({
        message: 'Error al generar datos de prueba',
        error: error.message
      });
    }
  }

  async getCameraStream({ auth, response }: HttpContext) {
    try {
      await auth.user! // Verificar autenticación
    
      // Configuración de la webcam (ajusta según tu setup)
      const cameraConfig = {
        boxId: 1,
        streamUrl: "http://192.168.137.192:8080/?action=stream",
        status: "online",
        timestamp: new Date().toISOString(),
        resolution: "1280x720",
        fps: 30
      };
      
      return response.ok(cameraConfig);
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración de cámara:', error);
      return response.internalServerError({
        message: 'Error al obtener configuración de cámara',
        error: error.message
      });
    }
  }
}
