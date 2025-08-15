import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import MongoClient from './mongo_client.js'
import SafeBox from '#models/safe_box'

// Interfaces para los datos de sensores
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

class SocketService {
  public io: Server | null = null
  private sensorSimulations: Map<number, NodeJS.Timeout> = new Map()

  init(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // En producción, restringe esto a tu dominio de frontend
        methods: ['GET', 'POST']
      }
    })

    // Conectar a MongoDB al inicializar
    this.connectMongoDB()

    // Manejo de conexiones
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Unirse al canal de sensores para una caja específica
      socket.on('join:box_sensors', async (data: { boxId: number, token: string }) => {
        try {
          // TODO: Verificar token de autenticación (opcional)
          
          // Validar que la caja existe
          const boxExists = await SafeBox.find(data.boxId)
          if (!boxExists) {
            socket.emit('error', { message: 'La caja especificada no existe' })
            return
          }
          
          console.log(`Client ${socket.id} joined sensors for box ${data.boxId}`)
          
          // Unirse a la sala específica para esta caja
          const roomName = `box:${data.boxId}`
          socket.join(roomName)
          
          // Enviar datos iniciales
          this.sendLatestSensorData(socket, data.boxId)
          
          // Iniciar simulación si no está en marcha para esta caja
          this.startSensorSimulation(data.boxId)
        } catch (error) {
          console.error('Error joining box sensors:', error)
          socket.emit('error', { message: 'Error al unirse a los sensores de la caja' })
        }
      })

      // Salir del canal de sensores para una caja específica
      socket.on('leave:box_sensors', (data: { boxId: number }) => {
        const roomName = `box:${data.boxId}`
        socket.leave(roomName)
        console.log(`Client ${socket.id} left sensors for box ${data.boxId}`)
        
        // Verificar si quedan clientes en la sala
        const room = this.io?.sockets.adapter.rooms.get(roomName)
        if (!room || room.size === 0) {
          this.stopSensorSimulation(data.boxId)
        }
      })

      // Desconexión
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
        
        // Al desconectarse, verificar todas las simulaciones activas
        // y detener las que no tengan clientes
        this.checkAndCleanupSimulations()
      })
    })

    console.log('Socket.io initialized with multi-box support')
  }

  private async connectMongoDB() {
    try {
      if (!MongoClient.isConnectedToMongo()) {
        await MongoClient.connect()
        console.log('MongoDB connected for Socket.io service')
      }
    } catch (error) {
      console.error('MongoDB connection error:', error)
    }
  }

  private async sendLatestSensorData(socket: any, boxId: number) {
    try {
      // Intentar obtener últimos datos de MongoDB
      let initialData

      try {
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

        initialData = {
          boxId,
          temperature: latestTemperature.length > 0 
            ? { value: latestTemperature[0].temperature, timestamp: latestTemperature[0].createdAt }
            : { value: parseFloat((Math.random() * 30 + 10).toFixed(1)), timestamp: new Date() },
          
          humidity: latestHumidity.length > 0
            ? { value: latestHumidity[0].humidity, timestamp: latestHumidity[0].createdAt }
            : { value: parseFloat((Math.random() * 80 + 20).toFixed(1)), timestamp: new Date() }
        }
      } catch (mongoError) {
        console.warn(`No se pudieron obtener datos de MongoDB para box ${boxId}, usando datos simulados:`, mongoError)
        // Datos de fallback si MongoDB no está disponible
        initialData = {
          boxId,
          temperature: {
            value: parseFloat((Math.random() * 30 + 10).toFixed(1)),
            timestamp: new Date()
          },
          humidity: {
            value: parseFloat((Math.random() * 80 + 20).toFixed(1)),
            timestamp: new Date()
          }
        }
      }
      
      socket.emit('sensors:initialData', initialData)
    } catch (error) {
      console.error(`Error sending initial sensor data for box ${boxId}:`, error)
    }
  }

  private startSensorSimulation(boxId: number) {
    if (this.sensorSimulations.has(boxId)) {
      return // Ya está en marcha
    }

    console.log(`Starting sensor simulation for box ${boxId}`)
    const interval = setInterval(() => {
      this.generateAndSendSensorData(boxId)
    }, 2000) // Enviar datos cada 2 segundos
    
    this.sensorSimulations.set(boxId, interval)
  }

  private stopSensorSimulation(boxId: number) {
    const interval = this.sensorSimulations.get(boxId)
    if (interval) {
      console.log(`Stopping sensor simulation for box ${boxId}`)
      clearInterval(interval)
      this.sensorSimulations.delete(boxId)
    }
  }

  private checkAndCleanupSimulations() {
    for (const [boxId] of this.sensorSimulations) {
      const roomName = `box:${boxId}`
      const room = this.io?.sockets.adapter.rooms.get(roomName)
      
      if (!room || room.size === 0) {
        this.stopSensorSimulation(boxId)
      }
    }
  }

  private async generateAndSendSensorData(boxId: number) {
    try {
      if (!this.io) return

      // Generar datos aleatorios para cada sensor
      const temperature = parseFloat((Math.random() * 30 + 10).toFixed(1)) // 10-40°C
      const humidity = parseFloat((Math.random() * 80 + 20).toFixed(1))    // 20-100%

      const now = new Date()

      // Crear objeto de datos
      const sensorData = {
        boxId,
        temperature: {
          value: temperature,
          timestamp: now
        },
        humidity: {
          value: humidity,
          timestamp: now
        }
      }

      // Enviar a todos los clientes en el canal de sensores específico para esta caja
      const roomName = `box:${boxId}`
      this.io.to(roomName).emit('sensors:update', sensorData)

      // Almacenar en MongoDB
      await this.storeSensorData(sensorData)
    } catch (error) {
      console.error(`Error generating sensor data for box ${boxId}:`, error)
    }
  }

  private async storeSensorData(sensorData: any) {
    try {
      // Almacenar en MongoDB
      const temperatureRecord: TemperatureSensor = {
        boxId: sensorData.boxId,
        temperature: sensorData.temperature.value,
        createdAt: sensorData.temperature.timestamp
      }

      const humidityRecord: HumiditySensor = {
        boxId: sensorData.boxId,
        humidity: sensorData.humidity.value,
        createdAt: sensorData.humidity.timestamp
      }

      // Insertar en las colecciones
      await MongoClient.collection<TemperatureSensor>('temperature_sensors').insertOne(temperatureRecord)
      await MongoClient.collection<HumiditySensor>('humidity_sensors').insertOne(humidityRecord)

      console.log(`Sensor data stored in MongoDB for box ${sensorData.boxId}`)
    } catch (error) {
      console.error(`Error storing sensor data in MongoDB for box ${sensorData.boxId}:`, error)
    }
  }
}

// Exportar instancia única
export default new SocketService()