import { HttpContext } from '@adonisjs/core/http'
import MongoClient from '#services/mongo_client'
import SafeBox from '#models/safe_box'

// Interfaces actualizadas para la estructura REAL de MongoDB
interface TemperatureSensor {
  box_id: number
  sensor: string
  valor: number
  timestamp: Date
}

interface HumiditySensor {
  box_id: number
  sensor: string
  valor: number
  timestamp: Date
}

interface WeightSensor {
  box_id: number
  sensor: string
  valor: number
  timestamp: Date
}

export default class SensorsController {
  
  // Método actualizado para obtener datos REALES de las colecciones correctas
  async getPollingData({ auth, response }: HttpContext) {
    try {
      await auth.user! // Solo verificar que esté autenticado
      const targetBoxId = 1;
      
      // Conectar a MongoDB
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }

      console.log('📊 Obteniendo datos REALES de sensores desde MongoDB...');
      
      // Obtener los últimos datos REALES de cada colección de la Raspberry
      const [latestTemperature, latestHumidity, latestWeight] = await Promise.all([
        MongoClient.collection<TemperatureSensor>('temperatura')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
        
        MongoClient.collection<HumiditySensor>('humedad')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
        
        MongoClient.collection<WeightSensor>('peso')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray()
      ]);

      // Preparar respuesta con los datos reales o null si no hay datos
      const sensorData = {
        boxId: targetBoxId,
        timestamp: new Date().toISOString(),
        sensors: {
          temperature: latestTemperature.length > 0 ? {
            value: latestTemperature[0].valor,
            unit: "°C",
            timestamp: latestTemperature[0].timestamp.toISOString(),
            sensor: latestTemperature[0].sensor
          } : null,
          humidity: latestHumidity.length > 0 ? {
            value: latestHumidity[0].valor,
            unit: "%",
            timestamp: latestHumidity[0].timestamp.toISOString(),
            sensor: latestHumidity[0].sensor
          } : null,
          weight: latestWeight.length > 0 ? {
            value: latestWeight[0].valor,
            unit: "kg",
            timestamp: latestWeight[0].timestamp.toISOString(),
            sensor: latestWeight[0].sensor
          } : null
        }
      };

      // Log para debug - mostrar datos encontrados
      if (latestTemperature.length > 0) {
        console.log(`🌡️ Temperatura: ${latestTemperature[0].valor}°C (${latestTemperature[0].sensor}) - ${latestTemperature[0].timestamp}`);
      } else {
        console.log('🌡️ No hay datos de temperatura en colección "temperatura"');
      }
      
      if (latestHumidity.length > 0) {
        console.log(`💧 Humedad: ${latestHumidity[0].valor}% (${latestHumidity[0].sensor}) - ${latestHumidity[0].timestamp}`);
      } else {
        console.log('💧 No hay datos de humedad en colección "humedad"');
      }
      
      if (latestWeight.length > 0) {
        console.log(`⚖️ Peso: ${latestWeight[0].valor}kg (${latestWeight[0].sensor}) - ${latestWeight[0].timestamp}`);
      } else {
        console.log('⚖️ No hay datos de peso en colección "peso"');
      }
      
      return response.ok(sensorData);

    } catch (error) {
      console.error('❌ Error en polling de sensores:', error);
      
      // Fallback: devolver estructura vacía si hay error
      const fallbackData = {
        boxId: 1,
        timestamp: new Date().toISOString(),
        sensors: {
          temperature: null,
          humidity: null,
          weight: null
        }
      };
      
      console.log('⚠️ Usando datos de fallback debido a error');
      return response.ok(fallbackData);
    }
  }

  // Método actualizado para obtener últimos datos REALES
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

      const targetBoxId = boxId ? parseInt(boxId) : 1;

      console.log(`📊 Obteniendo últimos datos REALES para boxId: ${targetBoxId}`);

      // Obtener de las colecciones REALES de la Raspberry
      const [latestTemperature, latestHumidity, latestWeight] = await Promise.all([
        MongoClient.collection<TemperatureSensor>('temperatura')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
        
        MongoClient.collection<HumiditySensor>('humedad')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray(),
        
        MongoClient.collection<WeightSensor>('peso')
          .find({ box_id: targetBoxId })
          .sort({ timestamp: -1 })
          .limit(1)
          .toArray()
      ]);

      const result = {
        boxId: targetBoxId,
        timestamp: new Date().toISOString(),
        sensors: {
          temperature: latestTemperature.length > 0 ? {
            value: latestTemperature[0].valor,
            unit: "°C",
            timestamp: latestTemperature[0].timestamp.toISOString(),
            sensor: latestTemperature[0].sensor
          } : null,
          humidity: latestHumidity.length > 0 ? {
            value: latestHumidity[0].valor,
            unit: "%",
            timestamp: latestHumidity[0].timestamp.toISOString(),
            sensor: latestHumidity[0].sensor
          } : null,
          weight: latestWeight.length > 0 ? {
            value: latestWeight[0].valor,
            unit: "kg",
            timestamp: latestWeight[0].timestamp.toISOString(),
            sensor: latestWeight[0].sensor
          } : null
        }
      }

      console.log(`✅ Últimos datos REALES obtenidos para boxId: ${targetBoxId}`);
      
      return response.ok(result)
      
    } catch (error) {
      console.error('❌ Error obteniendo últimos datos:', error);
      return response.internalServerError({
        message: 'Error al obtener últimos datos de sensores',
        error: error.message
      })
    }
  }

  // Método actualizado para datos históricos REALES
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

      const targetBoxId = boxId ? parseInt(boxId) : 1;
      
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours))

      let data = []

      console.log(`📊 Obteniendo datos históricos REALES de ${sensor} para boxId: ${targetBoxId} desde ${hoursAgo}`);

      // Usar las colecciones REALES de la Raspberry
      switch (sensor) {
        case 'temperature':
          data = await MongoClient.collection<TemperatureSensor>('temperatura')
            .find({ 
              box_id: targetBoxId,
              timestamp: { $gte: hoursAgo }
            })
            .sort({ timestamp: 1 })
            .toArray()
          break
        case 'humidity':
          data = await MongoClient.collection<HumiditySensor>('humedad')
            .find({ 
              box_id: targetBoxId,
              timestamp: { $gte: hoursAgo }
            })
            .sort({ timestamp: 1 })
            .toArray()
          break
        case 'weight':
          data = await MongoClient.collection<WeightSensor>('peso')
            .find({ 
              box_id: targetBoxId,
              timestamp: { $gte: hoursAgo }
            })
            .sort({ timestamp: 1 })
            .toArray()
          break
        default:
          return response.badRequest({
            message: 'Tipo de sensor no válido. Use: temperature, humidity, weight'
          })
      }

      // Transformar datos para mantener compatibilidad con la respuesta anterior
      const transformedData = data.map(item => ({
        value: item.valor,
        timestamp: item.timestamp,
        sensor: item.sensor
      }))

      console.log(`✅ Obtenidos ${transformedData.length} registros históricos REALES de ${sensor}`);

      return response.ok({
        boxId: targetBoxId,
        sensor,
        data: transformedData
      })
    } catch (error) {
      console.error('❌ Error obteniendo datos históricos:', error);
      return response.internalServerError({
        message: 'Error al obtener datos históricos',
        error: error.message
      })
    }
  }

  // ELIMINAR método generateTestData ya que ahora usamos datos reales
  // async generateTestData() { ... } // COMENTADO O ELIMINADO

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

  async updateSecurityCode({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user! // Verificar autenticación
    
      // Validar datos de entrada
      const { boxId, codigo } = request.body()
      
      if (!boxId || !codigo) {
        return response.badRequest({
          message: 'boxId y codigo son requeridos'
        })
      }
      
      // Validar que el código sea numérico y tenga al menos 4 dígitos
      const codigoNumerico = parseInt(codigo)
      if (isNaN(codigoNumerico) || codigo.toString().length < 4) {
        return response.badRequest({
          message: 'El código debe ser numérico y tener al menos 4 dígitos'
        })
      }
      
      // Conectar a MongoDB
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
      }
      
      console.log(`🔐 Actualizando código de seguridad para boxId: ${boxId}`);
      
      // Buscar y actualizar el documento existente
      const updateResult = await MongoClient.collection('seguridad').updateOne(
        { box: boxId }, // Filtro: buscar por boxId
        { 
          $set: { 
            codigo: codigoNumerico,
            updatedAt: new Date()
          } 
        }
      );
      
      if (updateResult.matchedCount === 0) {
        return response.notFound({
          message: `No se encontró registro de seguridad para boxId: ${boxId}`
        });
      }
      
      if (updateResult.modifiedCount === 0) {
        return response.badRequest({
          message: 'No se pudo actualizar el código de seguridad'
        });
      }
      
      // Obtener el documento actualizado para confirmación
      const updatedDocument = await MongoClient.collection('seguridad').findOne({ box: boxId });
      
      console.log(`✅ Código de seguridad actualizado exitosamente para boxId: ${boxId}`);
      
      return response.ok({
        message: 'Código de seguridad actualizado exitosamente',
        boxId: boxId,
        newCode: codigoNumerico,
        updatedAt: new Date().toISOString(),
        document: updatedDocument
      });
      
    } catch (error) {
      console.error('❌ Error actualizando código de seguridad:', error);
      return response.internalServerError({
        message: 'Error al actualizar código de seguridad',
        error: error.message
      });
    }
  }
}
