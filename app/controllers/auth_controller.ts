import User from '#models/user'
import Role from '#models/role'
import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const userSchema = vine.compile(
      vine.object({
        name: vine.string(),
        lastName: vine.string().trim(),
        email: vine.string().email(),
        password: vine.string().minLength(6),
        birthDate: vine.date().optional(),
        roleId: vine.number().optional(), // Permitir especificar rol (opcional)
      })
    )

    try {
      const data = await request.validateUsing(userSchema)
      
      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        return response.badRequest({
          message: 'El usuario ya existe'
        })
      }
      
      // Por defecto, asignar rol de usuario (id: 3)
      let roleId = 3; // Usuario normal
      
      if (data.roleId) {
        // Si se especificó un rol, verificar que exista
        const role = await Role.find(data.roleId)
        if (role) {
          roleId = role.id
        }
      }
      
      const user = await User.create({
        name: data.name,
        lastName: data.lastName,
        birthDate: data.birthDate ? DateTime.fromJSDate(data.birthDate) : undefined,
        email: data.email,
        password: data.password,
        roleId: roleId
      })

      // Cargar el rol para incluirlo en la respuesta
      await user.load('role')

      return response.created({ 
        message: 'Usuario registrado correctamente',
        user: user.serialize()
      })
    } catch (error) {
      return response.badRequest({
        message: 'Error al registrar usuario',
        errors: error.messages || error.message
      })
    }
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      console.log('Intentando login con:', { email, password })
      
      const user = await User.findBy('email', email)
      if (!user) {
        console.log('Usuario no encontrado')
        return response.unauthorized({ message: 'Credenciales inválidas' })
      }
      
      console.log('Usuario encontrado:', user.email)
      console.log('Hash almacenado:', user.password)
      
      console.log('Verificando contraseña...')
      const isPasswordValid = await hash.verify(user.password, password)
      console.log('Contraseña válida:', isPasswordValid)
      
      if (!isPasswordValid) {
        console.log('Contraseña incorrecta')
        return response.unauthorized({ message: 'Contraseña incorrecta' })
      }
      
      console.log('¡Autenticación exitosa!')
      
      // Cargar el rol del usuario
      await user.load('role')
      
      const accessToken = await User.accessTokens.create(user, ['*'], {
        name: 'api_token',
        expiresIn: '7 days'
      })
      
      return response.ok({
        token: accessToken.value!.release(),
        user: user.serialize()
      })
    } catch (error) {
      console.error('Error durante login:', error)
      return response.unauthorized({ message: 'Error de autenticación' })
    }
  }

  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.unauthorized({ message: 'No autenticado' })
      }
      
      // Cargar el rol del usuario
      await user.load('role')
      
      // Cargar las cajas según el rol
      if (user.role.name === 'provider') {
        await user.load('providedBoxes')
      } else if (user.role.name === 'user') {
        await user.load('ownedBoxes')
      }
      
      return response.ok({ user: user.serialize() })
    } catch (error) {
      return response.unauthorized({ 
        message: 'No autenticado' 
      })
    }
  }

  async logout({ auth, response }: HttpContext) {
    try {
      const user = auth.user
      if (!user) {
        return response.unauthorized({ message: 'No autenticado' })
      }
      
      // Revocar el token actual
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
      
      return response.ok({ 
        message: 'Sesión cerrada correctamente' 
      })
    } catch (error) {
      return response.unauthorized({ 
        message: 'No autenticado' 
      })
    }
  }
}