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
  }).use(middleware.auth())
  
}).prefix('/api/auth')

// Ruta por defecto
router.get('/', async ({ response }) => {
  return response.status(200).json({ message: 'NeoSafe API' })
})