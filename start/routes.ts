import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

// Rutas de autenticación
router.group(() => {
  // Rutas públicas
  router.post('/register', '#controllers/auth_controller.register')
  router.post('/login', '#controllers/auth_controller.login')

  // Rutas protegidas que requieren autenticación
  router.group(() => {
    router.get('/me', '#controllers/auth_controller.me')
    router.post('/logout', '#controllers/auth_controller.logout')
    router.get('/perfil', [() => import('#controllers/perfil_controller'), 'show'])
    router.put('/perfil', [() => import('#controllers/perfil_controller'), 'update'])
    router.put('/perfil/password', [() => import('#controllers/perfil_controller'), 'updatePassword'])

  }).use(middleware.auth())

}).prefix('/api/auth')

// Rutas para cajas fuertes (todas protegidas)
router.group(() => {
  router.get('/', '#controllers/safe_boxes_controller.index')
  router.get('/:id', '#controllers/safe_boxes_controller.show')
  router.post('/', '#controllers/safe_boxes_controller.store')
  router.put('/:id', '#controllers/safe_boxes_controller.update')
  router.delete('/:id', '#controllers/safe_boxes_controller.destroy')
  router.post('/claim', '#controllers/safe_boxes_controller.claimBox')
  router.post('/claim-with-code', '#controllers/safe_boxes_controller.claimBoxWithCode')
}).prefix('/api/safe-boxes').use(middleware.auth())




// Rutas para sensores
router.group(() => {
  router.get('/latest', '#controllers/sensors_controller.getLatestData')
  router.get('/historical', '#controllers/sensors_controller.getHistoricalData')
  router.get('/polling', '#controllers/sensors_controller.getPollingData')
  router.get('/polling/multi', '#controllers/sensors_controller.getMultiBoxPollingData')
  router.post('/generate-test-data', '#controllers/sensors_controller.generateTestData')
  router.get('/camera', '#controllers/sensors_controller.getCameraStream') // Agregar esta línea
  router.put('/security-code', '#controllers/sensors_controller.updateSecurityCode')
  router.post('/open-box', '#controllers/sensors_controller.sendOpenBoxSignal')
   // Nueva ruta
}).prefix('/api/sensors').use(middleware.auth())

// Rutas para proveedores (todas protegidas)
router.group(() => {
  router.get('/', '#controllers/providers_controller.index')
  router.get('/:id', '#controllers/providers_controller.show')
  router.put('/:id', '#controllers/providers_controller.update')
  router.delete('/:id', '#controllers/providers_controller.destroy')
}).prefix('/api/providers').use(middleware.auth())

// Ruta temporal para crear datos de prueba (REMOVER EN PRODUCCIÓN)
router.get('/api/seed-providers', async ({ response }) => {
  try {
    const { default: TestProvidersSeeder } = await import('#services/test_providers_seeder')
    await TestProvidersSeeder.createTestProviders()
    return response.ok({ message: 'Proveedores de prueba creados exitosamente' })
  } catch (error) {
    return response.internalServerError({ message: 'Error al crear proveedores de prueba', error: error.message })
  }
})

// Ruta por defecto
router.get('/', async ({ response }) => {
  return response.status(200).json({ message: 'NeoSafe API' })
})
