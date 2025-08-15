import { MongoClient, Db, Collection, Document } from 'mongodb'
import env from '#start/env'

class MongoDbService {
  private client: MongoClient | null = null
  private db: Db | null = null
  private isConnected = false
  private readonly url: string
  private readonly dbName: string

  constructor() {
    this.url = env.get('MONGODB_URL', 'mongodb://admin:1q2w3e4r@18.188.176.183:27017,18.221.125.1:27017,3.16.29.115:27017/?replicaSet=rsCaja')
    this.dbName = env.get('MONGODB_DB_NAME', 'sensores_neosafe')
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      console.log(`🔗 Intentando conectar a MongoDB...`)
      console.log(`📍 URL: ${this.url}`)
      console.log(`📍 DB Name: ${this.dbName}`)
      
      // Opciones específicas para replica set
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000, // Aumentado a 10 segundos
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
        authSource: 'admin', // Especificar la fuente de autenticación
        ssl: false, // Si es necesario
        directConnection: false, // Para replica sets
        replicaSet: 'rsCaja' // Especificar el replica set
      }
      
      this.client = new MongoClient(this.url, options)
      console.log(`📡 Cliente MongoDB creado, conectando...`)

      await this.client.connect()
      console.log(`🔌 Cliente conectado, obteniendo base de datos...`)

      this.db = this.client.db(this.dbName)
      console.log(`📚 Base de datos obtenida: ${this.dbName}`)

      // Hacer una prueba de ping para verificar la conexión
      await this.db.command({ ping: 1 })
      console.log(`🏓 Ping exitoso a MongoDB`)

      this.isConnected = true
      console.log(`✅ Connected to MongoDB (${this.dbName})`)
    } catch (error) {
      console.error(`❌ MongoDB connection error:`, error)
      console.error(`🔍 Error details:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        codeName: error.codeName
      })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.client) {
      return
    }

    try {
      await this.client.close()
      this.isConnected = false
      this.client = null
      this.db = null
      console.log('Disconnected from MongoDB')
    } catch (error) {
      console.error('MongoDB disconnection error:', error)
      throw error
    }
  }

  collection<T extends Document>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error('MongoDB is not connected')
    }

    return this.db.collection<T>(name)
  }

  isConnectedToMongo(): boolean {
    return this.isConnected
  }
}

// Exportar una instancia única
export default new MongoDbService()