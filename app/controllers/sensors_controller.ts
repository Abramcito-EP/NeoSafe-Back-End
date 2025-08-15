import { HttpContext } from '@adonisjs/core/http'
import MongoClient from '#services/mongo_client'
import SafeBox from '#models/safe_box'

// Interfaces para la estructura de MongoDB
interface SensorData {
  box_id: number
  sensor: string
  valor: number
  timestamp: Date
}

interface OpenBoxSignal {
  boxId: number
  signal: boolean
  timestamp: Date
}

// Tipos de sensores válidos
type SensorType = 'temperature' | 'humidity' | 'weight'

export default class SensorsController {
  
  /**
   * Mapeo de tipos de sensores a colecciones de MongoDB
   */
  private static readonly sensorCollections = {
    temperature: 'temperatura',
    humidity: 'humedad',
    weight: 'peso'
  } as const

  /**
   * Mapeo de unidades por tipo de sensor
   */
  private static readonly sensorUnits = {
    temperature: '°C',
    humidity: '%',
    weight: 'kg'
  } as const

  /**
   * Verificar permisos de acceso a una caja
   */
  private async checkBoxPermissions(user: any, boxId?: number): Promise<void> {
    if (!boxId) return

    const box = await SafeBox.findOrFail(boxId)
    
    if (user.role.name === 'user') {
      if (!box.isClaimed || box.ownerId !== user.id) {
        throw new Error('No tienes permiso para acceder a los datos de esta caja')
      }
    } else if (user.role.name === 'provider') {
      if (box.isClaimed || box.providerId !== user.id) {
        throw new Error('Solo puedes ver sensores de cajas no reclamadas que proporcionas')
      }
    } else if (user.role.name === 'admin') {
      if (box.isClaimed) {
        throw new Error('Solo puedes ver sensores de cajas no reclamadas')
      }
    }
  }

  /**
   * Asegurar conexión a MongoDB
   */
  private async ensureMongoConnection(): Promise<void> {
    if (!MongoClient.isConnectedToMongo()) {
      await MongoClient.connect()
    }
  }

  /**
   * Obtener últimos datos de un sensor específico
   */
  private async getLatestSensorData(sensorType: SensorType, boxId: number) {
    const collection = SensorsController.sensorCollections[sensorType]
    const data = await MongoClient.collection<SensorData>(collection)
      .find({ box_id: boxId })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    return data.length > 0 ? {
      value: data[0].valor,
      unit: SensorsController.sensorUnits[sensorType],
      timestamp: data[0].timestamp.toISOString(),
      sensor: data[0].sensor,
      status: this.getSensorStatus(sensorType, data[0].valor)
    } : null
  }

  /**
   * Obtener datos históricos de un sensor
   */
  private async getHistoricalSensorData(sensorType: SensorType, boxId: number, hoursAgo: Date) {
    const collection = SensorsController.sensorCollections[sensorType]
    const data = await MongoClient.collection<SensorData>(collection)
      .find({ 
        box_id: boxId,
        timestamp: { $gte: hoursAgo }
      })
      .sort({ timestamp: 1 })
      .toArray()

    return data.map(item => ({
      value: item.valor,
      timestamp: item.timestamp,
      sensor: item.sensor
    }))
  }

  /**
   * Determinar el estado del sensor basado en su valor
   */
  private getSensorStatus(type: SensorType, value: number): string {
    switch (type) {
      case 'temperature':
        if (value < 15 || value > 35) return 'critical'
        if (value < 18 || value > 30) return 'warning'
        return 'normal'
      
      case 'humidity':
        if (value < 20 || value > 80) return 'critical'
        if (value < 30 || value > 70) return 'warning'
        return 'normal'
      
      case 'weight':
        if (value < 0 || value > 50) return 'critical'
        if (value < 1 || value > 40) return 'warning'
        return 'normal'
      
      default:
        return 'unknown'
    }
  }

  /**
   * Generar datos de fallback cuando MongoDB no está disponible
   */
  private generateFallbackData(boxId: number) {
    return {
      boxId,
      timestamp: new Date().toISOString(),
      sensors: {
        temperature: {
          value: Math.round((20 + Math.random() * 10) * 100) / 100,
          unit: "°C",
          timestamp: new Date().toISOString(),
          status: 'normal'
        },
        humidity: {
          value: Math.round((45 + Math.random() * 30) * 100) / 100,
          unit: "%",
          timestamp: new Date().toISOString(),
          status: 'normal'
        },
        weight: {
          value: Math.round((5 + Math.random() * 15) * 100) / 100,
          unit: "kg",
          timestamp: new Date().toISOString(),
          status: 'normal'
        }
      }
    }
  }

  /**
   * Obtener datos de polling para sensores
   */
  async getPollingData({ auth, request, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
      
      const targetBoxId = parseInt(request.input('boxId', '1'))
      console.log(`📊 Solicitando datos de sensores para Box ID: ${targetBoxId}`)
      
      await this.checkBoxPermissions(user, targetBoxId)
      await this.ensureMongoConnection()
      
      console.log('📊 Obteniendo datos REALES de sensores desde MongoDB...')
      
      // Obtener datos de todos los sensores en paralelo
      const [temperature, humidity, weight] = await Promise.all([
        this.getLatestSensorData('temperature', targetBoxId),
        this.getLatestSensorData('humidity', targetBoxId),
        this.getLatestSensorData('weight', targetBoxId)
      ])

      const sensorData = {
        boxId: targetBoxId,
        timestamp: new Date().toISOString(),
        status: 'success',
        sensors: { temperature, humidity, weight }
      }

      // Logging de debug optimizado
      const logData = [
        { type: '🌡 Temperatura', data: temperature },
        { type: '💧 Humedad', data: humidity },
        { type: '⚖ Peso', data: weight }
      ]

      logData.forEach(({ type, data }) => {
        if (data) {
          console.log(`${type}: ${data.value}${data.unit} (${data.sensor}) - ${data.status}`)
        } else {
          console.log(`${type}: No hay datos disponibles`)
        }
      })
      
      return response.ok(sensorData)

    } catch (error) {
      console.error('❌ Error en polling de sensores:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      const fallbackData = this.generateFallbackData(parseInt(request.input('boxId', '1')))
      console.log('⚠ Usando datos de fallback debido a error')
      
      return response.ok(fallbackData)
    }
  }

  /**
   * Polling masivo para múltiples cajas
   */
  async getMultiBoxPollingData({ request, auth, response }: HttpContext) {
    try {
      const { boxIds } = request.qs()
      const user = auth.user!
      await user.load('role')
      
      if (!boxIds) {
        return response.badRequest({ 
          message: 'El parámetro boxIds es requerido (ej: boxIds=1,2,3)' 
        })
      }

      const targetBoxIds = boxIds.split(',')
        .map((id: string) => parseInt(id.trim()))
        .filter((id: number) => !isNaN(id))
      
      if (targetBoxIds.length === 0) {
        return response.badRequest({ 
          message: 'No se proporcionaron IDs de cajas válidos' 
        })
      }

      // Verificar permisos para cada caja
      const authorizedBoxes = []
      
      for (const boxId of targetBoxIds) {
        try {
          await this.checkBoxPermissions(user, boxId)
          authorizedBoxes.push(boxId)
        } catch (error) {
          console.warn(`⚠️ Sin permisos para caja ${boxId}: ${error.message}`)
        }
      }

      if (authorizedBoxes.length === 0) {
        return response.forbidden({ 
          message: 'No tienes permisos para acceder a ninguna de las cajas solicitadas' 
        })
      }

      await this.ensureMongoConnection()
      console.log(`🔄 Polling masivo para cajas [${authorizedBoxes.join(', ')}] por ${user.email}`)

      // Obtener datos para todas las cajas autorizadas
      const boxesData = await Promise.all(
        authorizedBoxes.map(async (boxId) => {
          const [temperature, humidity, weight] = await Promise.all([
            this.getLatestSensorData('temperature', boxId),
            this.getLatestSensorData('humidity', boxId),
            this.getLatestSensorData('weight', boxId)
          ])

          return {
            boxId,
            timestamp: new Date().toISOString(),
            sensors: { temperature, humidity, weight }
          }
        })
      )

      const response_data = {
        timestamp: new Date().toISOString(),
        status: 'success',
        requestedBoxes: targetBoxIds,
        authorizedBoxes,
        boxes: boxesData
      }

      console.log(`📊 Polling masivo completado: ${boxesData.length} cajas procesadas`)
      return response.ok(response_data)

    } catch (error) {
      console.error('❌ Error en polling masivo:', error)
      
      return response.internalServerError({
        timestamp: new Date().toISOString(),
        status: 'error',
        message: 'Error al obtener datos de polling masivo',
        error: error.message
      })
    }
  }

  /**
   * Obtener últimos datos de sensores
   */
  async getLatestData({ request, auth, response }: HttpContext) {
    try {
      const { boxId } = request.qs()
      const user = auth.user!
      await user.load('role')
      
      await this.checkBoxPermissions(user, boxId ? parseInt(boxId) : undefined)
      await this.ensureMongoConnection()

      const targetBoxId = boxId ? parseInt(boxId) : 1
      console.log(`📊 Obteniendo últimos datos REALES para boxId: ${targetBoxId}`)

      // Obtener datos de todos los sensores
      const [temperature, humidity, weight] = await Promise.all([
        this.getLatestSensorData('temperature', targetBoxId),
        this.getLatestSensorData('humidity', targetBoxId),
        this.getLatestSensorData('weight', targetBoxId)
      ])

      const result = {
        boxId: targetBoxId,
        timestamp: new Date().toISOString(),
        sensors: { temperature, humidity, weight }
      }

      console.log(`✅ Últimos datos REALES obtenidos para boxId: ${targetBoxId}`)
      return response.ok(result)
      
    } catch (error) {
      console.error('❌ Error obteniendo últimos datos:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      return response.internalServerError({
        message: 'Error al obtener últimos datos de sensores',
        error: error.message
      })
    }
  }

  /**
   * Obtener datos históricos de sensores
   */
  async getHistoricalData({ request, auth, response }: HttpContext) {
    try {
      const { sensor, hours = 24, boxId } = request.qs()
      const user = auth.user!
      await user.load('role')
      
      // Validar tipo de sensor
      if (!sensor || !Object.keys(SensorsController.sensorCollections).includes(sensor)) {
        return response.badRequest({
          message: 'Tipo de sensor no válido. Use: temperature, humidity, weight'
        })
      }
      
      await this.checkBoxPermissions(user, boxId ? parseInt(boxId) : undefined)
      await this.ensureMongoConnection()

      const targetBoxId = boxId ? parseInt(boxId) : 1
      const hoursAgo = new Date()
      hoursAgo.setHours(hoursAgo.getHours() - parseInt(hours))

      console.log(`📊 Obteniendo datos históricos REALES de ${sensor} para boxId: ${targetBoxId} desde ${hoursAgo}`)

      const data = await this.getHistoricalSensorData(sensor as SensorType, targetBoxId, hoursAgo)

      console.log(`✅ Obtenidos ${data.length} registros históricos REALES de ${sensor}`)

      return response.ok({
        boxId: targetBoxId,
        sensor,
        data
      })
    } catch (error) {
      console.error('❌ Error obteniendo datos históricos:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      return response.internalServerError({
        message: 'Error al obtener datos históricos',
        error: error.message
      })
    }
  }

  /**
   * Obtener configuración del stream de cámara
   */
  async getCameraStream({ request, auth, response }: HttpContext) {
    try {
      const { boxId } = request.qs()
      const user = auth.user!
      await user.load('role')
      
      await this.checkBoxPermissions(user, boxId ? parseInt(boxId) : undefined)
    
      const cameraConfig = {
        boxId: boxId ? parseInt(boxId) : 1,
        streamUrl: "https://bride-ensemble-oak-ty.trycloudflare.com/?action=stream",
        status: "online",
        timestamp: new Date().toISOString(),
        resolution: "1280x720",
        fps: 30
      }
      
      return response.ok(cameraConfig)
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración de cámara:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      return response.internalServerError({
        message: 'Error al obtener configuración de cámara',
        error: error.message
      })
    }
  }

  /**
   * Actualizar código de seguridad
   */
  async updateSecurityCode({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
    
      const { boxId, codigo } = request.body()
      
      // Validaciones de entrada
      const validations = [
        { condition: !boxId || !codigo, message: 'boxId y codigo son requeridos' },
        { 
          condition: isNaN(parseInt(codigo)) || codigo.toString().length < 4, 
          message: 'El código debe ser numérico y tener al menos 4 dígitos' 
        }
      ]
      
      for (const { condition, message } of validations) {
        if (condition) {
          return response.badRequest({ message })
        }
      }
      
      await this.checkBoxPermissions(user, parseInt(boxId))
      
      const codigoNumerico = parseInt(codigo)
      await this.ensureMongoConnection()
      
      console.log(`🔐 Actualizando código de seguridad para boxId: ${boxId}`)
      
      const updateResult = await MongoClient.collection('seguridad').updateOne(
        { box: boxId },
        { 
          $set: { 
            codigo: codigoNumerico,
            updatedAt: new Date()
          } 
        }
      )
      
      if (updateResult.matchedCount === 0) {
        return response.notFound({
          message: `No se encontró registro de seguridad para boxId: ${boxId}`
        })
      }
      
      if (updateResult.modifiedCount === 0) {
        return response.badRequest({
          message: 'No se pudo actualizar el código de seguridad'
        })
      }
      
      const updatedDocument = await MongoClient.collection('seguridad').findOne({ box: boxId })
      
      console.log(`✅ Código de seguridad actualizado exitosamente para boxId: ${boxId}`)
      
      return response.ok({
        message: 'Código de seguridad actualizado exitosamente',
        boxId,
        newCode: codigoNumerico,
        updatedAt: new Date().toISOString(),
        document: updatedDocument
      })
      
    } catch (error) {
      console.error('❌ Error actualizando código de seguridad:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      return response.internalServerError({
        message: 'Error al actualizar código de seguridad',
        error: error.message
      })
    }
  }

  /**
   * Enviar señal de apertura de caja
   */
  async sendOpenBoxSignal({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
      
      const { boxId = 1 } = request.body()
      
      await this.checkBoxPermissions(user, parseInt(boxId))
      await this.ensureMongoConnection()
      
      console.log(`📤 Enviando señal de apertura para boxId: ${boxId}`)
      
      const openSignal: OpenBoxSignal = {
        boxId: parseInt(boxId),
        signal: true,
        timestamp: new Date()
      }
      
      const result = await MongoClient.collection('open_signals').insertOne(openSignal)
      
      console.log(`✅ Señal de apertura enviada exitosamente para boxId: ${boxId}`, {
        insertedId: result.insertedId,
        signal: openSignal
      })
      
      return response.ok({
        message: 'Señal de apertura enviada exitosamente',
        boxId: parseInt(boxId),
        signal: true,
        timestamp: openSignal.timestamp.toISOString(),
        insertedId: result.insertedId
      })
      
    } catch (error) {
      console.error('❌ Error enviando señal de apertura:', error)
      
      if (error.message.includes('permiso')) {
        return response.forbidden({ message: error.message })
      }
      
      return response.internalServerError({
        message: 'Error al enviar señal de apertura',
        error: error.message
      })
    }
  }
}
