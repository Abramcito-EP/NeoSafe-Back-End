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
    router.patch('/perfil', [() => import('#controllers/perfil_controller'), 'update'])

  }).use(middleware.auth())

}).prefix('/api/auth')

// Rutas para cajas fuertes (todas protegidas)
router.group(() => {
  router.get('/', '#controllers/safe_boxes_controller.index')
  router.get('/:id', '#controllers/safe_boxes_controller.show')
  router.post('/', '#controllers/safe_boxes_controller.store')
  router.put('/:id', '#controllers/safe_boxes_controller.update')
  router.delete('/:id', '#controllers/safe_boxes_controller.destroy')
  router.post('/:id/generate-code', '#controllers/safe_boxes_controller.generatePropertyCode')
}).prefix('/api/safe-boxes').use(middleware.auth())

// Rutas para transferencia de cajas (todas protegidas)
router.group(() => {
  router.post('/request', '#controllers/box_transfer_controller.requestBox')
  router.get('/', '#controllers/box_transfer_controller.listTransferRequests')
  router.post('/:id/respond', '#controllers/box_transfer_controller.respondToRequest')
}).prefix('/api/box-transfers').use(middleware.auth())

// Rutas para sensores
router.group(() => {
  router.get('/latest', '#controllers/sensors_controller.getLatestData')
  router.get('/historical', '#controllers/sensors_controller.getHistoricalData')
  router.get('/polling', '#controllers/sensors_controller.getPollingData')
  router.post('/generate-test-data', '#controllers/sensors_controller.generateTestData')
  router.get('/camera', '#controllers/sensors_controller.getCameraStream') // Agregar esta línea
}).prefix('/api/sensors').use(middleware.auth())

// Ruta por defecto
router.get('/', async ({ response }) => {
  return response.status(200).json({ message: 'NeoSafe API' })
})
