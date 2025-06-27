import { MongoClient, Db, Collection, Document } from 'mongodb'
import env from '#start/env'

class MongoDbService {
  private client: MongoClient | null = null
  private db: Db | null = null
  private isConnected = false
  private readonly url: string
  private readonly dbName: string

  constructor() {
    this.url = env.get('MONGODB_URL', 'mongodb://localhost:27017')
    this.dbName = env.get('MONGODB_DB_NAME', 'neosafe_sensors')
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      this.client = new MongoClient(this.url)
      await this.client.connect()
      this.db = this.client.db(this.dbName)
      this.isConnected = true
      console.log('Connected to MongoDB')
    } catch (error) {
      console.error('MongoDB connection error:', error)
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