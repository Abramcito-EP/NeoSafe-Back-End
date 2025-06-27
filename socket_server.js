import { createServer } from 'http';
import { Server } from 'socket.io';
import { MongoClient } from 'mongodb';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configuración de MongoDB
const MONGODB_URL = 'mongodb+srv://admin:admin123@myatlasclusteredu.ommfywj.mongodb.net/sensores_neosafe';
const DB_NAME = 'sensores_neosafe';

let mongoClient = null;
let db = null;

// Conectar a MongoDB
async function connectMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URL);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️  Continuing without MongoDB...');
  }
}

// Simulación de datos de sensores
let sensorInterval = null;
const boxId = 1; // ID fijo para la simulación

// Función para almacenar datos en MongoDB
async function storeSensorData(sensorData) {
  if (!db) {
    console.log('MongoDB not connected, skipping data storage');
    return;
  }

  try {
    const now = new Date();
    
    // Insertar en colección temperatura
    await db.collection('temperatura').insertOne({
      boxId: boxId,
      temperatura: sensorData.temperature.value,
      timestamp: now
    });

    // Insertar en colección humedad
    await db.collection('humedad').insertOne({
      boxId: boxId,
      humedad: sensorData.humidity.value,
      timestamp: now
    });

    // Insertar en colección peso
    await db.collection('peso').insertOne({
      boxId: boxId,
      peso: sensorData.weight.value,
      timestamp: now
    });

    console.log('📊 Sensor data stored in MongoDB');
  } catch (error) {
    console.error('❌ Error storing sensor data:', error);
  }
}

// Función para obtener últimos datos de MongoDB
async function getLatestSensorData() {
  if (!db) {
    // Datos por defecto si no hay MongoDB
    return {
      temperature: { value: 25.0, timestamp: new Date() },
      humidity: { value: 50.0, timestamp: new Date() },
      weight: { value: 2.5, timestamp: new Date() }
    };
  }

  try {
    const latestTemp = await db.collection('temperatura')
      .findOne({ boxId }, { sort: { timestamp: -1 } });
    
    const latestHumidity = await db.collection('humedad')
      .findOne({ boxId }, { sort: { timestamp: -1 } });
    
    const latestWeight = await db.collection('peso')
      .findOne({ boxId }, { sort: { timestamp: -1 } });

    return {
      temperature: latestTemp 
        ? { value: latestTemp.temperatura, timestamp: latestTemp.timestamp }
        : { value: 25.0, timestamp: new Date() },
      humidity: latestHumidity 
        ? { value: latestHumidity.humedad, timestamp: latestHumidity.timestamp }
        : { value: 50.0, timestamp: new Date() },
      weight: latestWeight 
        ? { value: latestWeight.peso, timestamp: latestWeight.timestamp }
        : { value: 2.5, timestamp: new Date() }
    };
  } catch (error) {
    console.error('❌ Error getting latest sensor data:', error);
    // Datos por defecto en caso de error
    return {
      temperature: { value: 25.0, timestamp: new Date() },
      humidity: { value: 50.0, timestamp: new Date() },
      weight: { value: 2.5, timestamp: new Date() }
    };
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:sensors', async () => {
    console.log(`Client ${socket.id} joined sensors channel`);
    socket.join('sensors');
    
    // Enviar datos iniciales desde MongoDB
    const initialData = await getLatestSensorData();
    socket.emit('sensors:initialData', initialData);
    
    // Iniciar simulación si no está activa
    if (!sensorInterval) {
      console.log('Starting sensor simulation...');
      sensorInterval = setInterval(async () => {
        const now = new Date();
        const data = {
          temperature: {
            value: parseFloat((Math.random() * 30 + 10).toFixed(1)),
            timestamp: now
          },
          humidity: {
            value: parseFloat((Math.random() * 80 + 20).toFixed(1)),
            timestamp: now
          },
          weight: {
            value: parseFloat((Math.random() * 5).toFixed(2)),
            timestamp: now
          }
        };
        
        // Almacenar en MongoDB
        await storeSensorData(data);
        
        console.log('📡 Sending sensor data:', {
          temp: data.temperature.value,
          humidity: data.humidity.value,
          weight: data.weight.value
        });
        
        io.to('sensors').emit('sensors:update', data);
      }, 2000);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Si no hay clientes, detener simulación
    const sensorRoom = io.sockets.adapter.rooms.get('sensors');
    if (!sensorRoom || sensorRoom.size === 0) {
      if (sensorInterval) {
        console.log('Stopping sensor simulation...');
        clearInterval(sensorInterval);
        sensorInterval = null;
      }
    }
  });
});

// Inicializar MongoDB y servidor
async function startServer() {
  await connectMongoDB();
  
  httpServer.listen(3334, () => {
    console.log('✅ Socket.io server running on port 3334 with MongoDB Atlas');
  });
}

startServer();