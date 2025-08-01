import User from '#models/user'
import Role from '#models/role'
import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class AuthController {
  async register({ request, response }: HttpContext) {
    console.log('🚀 Iniciando proceso de registro...')
    console.log('🚀 ¡Algo bárbaro!...')
    console.log('📡 Headers recibidos:', request.headers())
    console.log('📦 Body recibido:', request.body())
    console.log('🔍 URL completa:', request.url())
    console.log('🔧 Método HTTP:', request.method())

    const userSchema = vine.compile(
      vine.object({
        name: vine.string(),
        lastName: vine.string().trim(),
        email: vine.string().email(),
        password: vine.string().minLength(6),
        birthDate: vine.date().optional(),
        roleId: vine.number().optional(),
      })
    )

    try {
      console.log('✅ Validando datos con schema...')
      const data = await request.validateUsing(userSchema)
      console.log('✅ Datos validados correctamente:', {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        birthDate: data.birthDate,
        roleId: data.roleId,
        passwordLength: data.password?.length
      })
      
      console.log('🔍 Verificando si el usuario ya existe...')
      const existingUser = await User.findBy('email', data.email)
      if (existingUser) {
        console.log('❌ Usuario ya existe:', data.email)
        return response.badRequest({
          message: 'El usuario ya existe'
        })
      }
      console.log('✅ Usuario no existe, procediendo con la creación...')
      
      // Por defecto, asignar rol de usuario (id: 3)
      let roleId = 3;
      
      if (data.roleId) {
        console.log('🔍 Verificando rol especificado:', data.roleId)
        const role = await Role.find(data.roleId)
        if (role) {
          roleId = role.id
          console.log('✅ Rol encontrado:', role.name)
        } else {
          console.log('⚠️ Rol no encontrado, usando rol por defecto')
        }
      }
      
      console.log('👤 Creando usuario con datos:', {
        name: data.name,
        lastName: data.lastName,
        email: data.email,
        roleId: roleId,
        birthDate: data.birthDate
      })

      const user = await User.create({
        name: data.name,
        lastName: data.lastName,
        birthDate: data.birthDate ? DateTime.fromJSDate(data.birthDate) : undefined,
        email: data.email,
        password: data.password,
        roleId: roleId
      })

      console.log('✅ Usuario creado con ID:', user.id)

      await user.load('role')
      console.log('✅ Rol cargado:', user.role?.name)

      const responseData = { 
        message: 'Usuario registrado correctamente',
        user: user.serialize()
      }

      console.log('📤 Enviando respuesta exitosa')
      return response.created(responseData)
    } catch (error) {
      console.error('❌ Error en el proceso de registro:')
      console.error('Tipo de error:', error.constructor.name)
      console.error('Mensaje:', error.message)
      console.error('Stack:', error.stack)
      if (error.messages) {
        console.error('Mensajes de validación:', error.messages)
      }

      return response.badRequest({
        message: 'Error al registrar usuario',
        errors: error.messages || error.message,
        errorType: error.constructor.name
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
