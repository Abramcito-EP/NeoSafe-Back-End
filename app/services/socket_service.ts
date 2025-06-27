import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import MongoClient from './mongo_client.js'

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

interface WeightSensor {
  boxId: number
  weight: number
  createdAt: Date
}

class SocketService {
  public io: Server | null = null
  private sensorSimulationInterval: NodeJS.Timeout | null = null
  private readonly boxId: number = 1 // ID fijo para la simulación

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

      // Unirse al canal de sensores
      socket.on('join:sensors', () => {
        console.log(`Client ${socket.id} joined sensors channel`)
        socket.join('sensors')
        
        // Enviar datos iniciales
        this.sendLatestSensorData(socket)
        
        // Iniciar simulación si no está en marcha
        this.startSensorSimulation()
      })

      // Desconexión
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
        
        // Si no hay clientes, detener la simulación
        const sensorRoom = this.io?.sockets.adapter.rooms.get('sensors')
        if (!sensorRoom || sensorRoom.size === 0) {
          this.stopSensorSimulation()
        }
      })
    })

    console.log('Socket.io initialized')
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

  private async sendLatestSensorData(socket: any) {
    try {
      // Intentar obtener últimos datos de MongoDB
      let initialData

      try {
        const latestTemperature = await MongoClient.collection<TemperatureSensor>('temperature_sensors')
          .find({ boxId: this.boxId })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray()

        const latestHumidity = await MongoClient.collection<HumiditySensor>('humidity_sensors')
          .find({ boxId: this.boxId })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray()

        const latestWeight = await MongoClient.collection<WeightSensor>('weight_sensors')
          .find({ boxId: this.boxId })
          .sort({ createdAt: -1 })
          .limit(1)
          .toArray()

        initialData = {
          temperature: latestTemperature.length > 0 
            ? { value: latestTemperature[0].temperature, timestamp: latestTemperature[0].createdAt }
            : { value: parseFloat((Math.random() * 30 + 10).toFixed(1)), timestamp: new Date() },
          
          humidity: latestHumidity.length > 0
            ? { value: latestHumidity[0].humidity, timestamp: latestHumidity[0].createdAt }
            : { value: parseFloat((Math.random() * 80 + 20).toFixed(1)), timestamp: new Date() },
          
          weight: latestWeight.length > 0
            ? { value: latestWeight[0].weight, timestamp: latestWeight[0].createdAt }
            : { value: parseFloat((Math.random() * 5).toFixed(2)), timestamp: new Date() }
        }
      } catch (mongoError) {
        console.warn('No se pudieron obtener datos de MongoDB, usando datos simulados:', mongoError)
        // Datos de fallback si MongoDB no está disponible
        initialData = {
          temperature: {
            value: parseFloat((Math.random() * 30 + 10).toFixed(1)),
            timestamp: new Date()
          },
          humidity: {
            value: parseFloat((Math.random() * 80 + 20).toFixed(1)),
            timestamp: new Date()
          },
          weight: {
            value: parseFloat((Math.random() * 5).toFixed(2)),
            timestamp: new Date()
          }
        }
      }
      
      socket.emit('sensors:initialData', initialData)
    } catch (error) {
      console.error('Error sending initial sensor data:', error)
    }
  }

  private startSensorSimulation() {
    if (this.sensorSimulationInterval) {
      return // Ya está en marcha
    }

    console.log('Starting sensor simulation')
    this.sensorSimulationInterval = setInterval(() => {
      this.generateAndSendSensorData()
    }, 2000) // Enviar datos cada 2 segundos
  }

  private stopSensorSimulation() {
    if (this.sensorSimulationInterval) {
      console.log('Stopping sensor simulation')
      clearInterval(this.sensorSimulationInterval)
      this.sensorSimulationInterval = null
    }
  }

  private async generateAndSendSensorData() {
    try {
      if (!this.io) return

      // Generar datos aleatorios para cada sensor
      const temperature = parseFloat((Math.random() * 30 + 10).toFixed(1)) // 10-40°C
      const humidity = parseFloat((Math.random() * 80 + 20).toFixed(1))    // 20-100%
      const weight = parseFloat((Math.random() * 5).toFixed(2))            // 0-5kg

      const now = new Date()

      // Crear objeto de datos
      const sensorData = {
        temperature: {
          value: temperature,
          timestamp: now
        },
        humidity: {
          value: humidity,
          timestamp: now
        },
        weight: {
          value: weight,
          timestamp: now
        }
      }

      // Enviar a todos los clientes en el canal de sensores
      this.io.to('sensors').emit('sensors:update', sensorData)

      // Almacenar en MongoDB
      await this.storeSensorData(sensorData)
    } catch (error) {
      console.error('Error generating sensor data:', error)
    }
  }

  private async storeSensorData(sensorData: any) {
    try {
      // Almacenar en MongoDB
      const temperatureRecord: TemperatureSensor = {
        boxId: this.boxId,
        temperature: sensorData.temperature.value,
        createdAt: sensorData.temperature.timestamp
      }

      const humidityRecord: HumiditySensor = {
        boxId: this.boxId,
        humidity: sensorData.humidity.value,
        createdAt: sensorData.humidity.timestamp
      }

      const weightRecord: WeightSensor = {
        boxId: this.boxId,
        weight: sensorData.weight.value,
        createdAt: sensorData.weight.timestamp
      }

      // Insertar en las colecciones
      await MongoClient.collection<TemperatureSensor>('temperature_sensors').insertOne(temperatureRecord)
      await MongoClient.collection<HumiditySensor>('humidity_sensors').insertOne(humidityRecord)
      await MongoClient.collection<WeightSensor>('weight_sensors').insertOne(weightRecord)

      console.log('Sensor data stored in MongoDB')
    } catch (error) {
      console.error('Error storing sensor data in MongoDB:', error)
    }
  }
}

// Exportar instancia única
export default new SocketService()