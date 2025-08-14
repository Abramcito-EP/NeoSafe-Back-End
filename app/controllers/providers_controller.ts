import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class ProvidersController {
  /**
   * Obtener todos los usuarios con rol de proveedor
   */
  async index({ response }: HttpContext) {
    try {
      console.log('📋 Obteniendo lista de proveedores...')
      
      const providers = await User.query()
        .where('role_id', 2) // rol de proveedor
        .preload('role')
        .orderBy('created_at', 'desc')

      console.log(`📊 Encontrados ${providers.length} proveedores`)

      const formattedProviders = providers.map(provider => ({
        id: provider.id,
        name: provider.name,
        lastName: provider.lastName,
        email: provider.email,
        birthDate: provider.birthDate,
        role: provider.role?.name,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      }))

      console.log('✅ Proveedores formateados:', formattedProviders.map(p => `${p.name} ${p.lastName} (${p.email})`))

      return response.ok({
        message: 'Proveedores obtenidos correctamente',
        providers: formattedProviders,
        total: formattedProviders.length
      })
    } catch (error) {
      console.error('❌ Error al obtener proveedores:', error)
      return response.internalServerError({
        message: 'Error al obtener la lista de proveedores',
        error: error.message
      })
    }
  }

  /**
   * Obtener un proveedor específico por ID
   */
  async show({ params, response }: HttpContext) {
    try {
      const provider = await User.query()
        .where('id', params.id)
        .where('role_id', 2) // Verificar que sea proveedor
        .preload('role')
        .preload('providedBoxes') // Cargar las cajas que ha proporcionado
        .first()

      if (!provider) {
        return response.notFound({
          message: 'Proveedor no encontrado'
        })
      }

      return response.ok({
        message: 'Proveedor obtenido correctamente',
        provider: {
          id: provider.id,
          name: provider.name,
          lastName: provider.lastName,
          email: provider.email,
          birthDate: provider.birthDate,
          role: provider.role?.name,
          providedBoxes: provider.providedBoxes,
          createdAt: provider.createdAt,
          updatedAt: provider.updatedAt,
        }
      })
    } catch (error) {
      console.error('❌ Error al obtener proveedor:', error)
      return response.internalServerError({
        message: 'Error al obtener el proveedor',
        error: error.message
      })
    }
  }

  /**
   * Actualizar un proveedor
   */
  async update({ params, request, response }: HttpContext) {
    const updateSchema = vine.compile(
      vine.object({
        name: vine.string().minLength(2).optional(),
        lastName: vine.string().minLength(2).optional(),
        email: vine.string().email().optional(),
        birthDate: vine.string().optional(),
      })
    )

    try {
      console.log('🔄 Actualizando proveedor ID:', params.id)
      
      const data = await request.validateUsing(updateSchema)
      
      const provider = await User.query()
        .where('id', params.id)
        .where('role_id', 2) // Verificar que sea proveedor
        .first()

      if (!provider) {
        return response.notFound({
          message: 'Proveedor no encontrado'
        })
      }

      // Verificar si el email ya existe (solo si se está cambiando)
      if (data.email && data.email !== provider.email) {
        const existingUser = await User.query()
          .where('email', data.email)
          .whereNot('id', provider.id)
          .first()

        if (existingUser) {
          return response.badRequest({
            message: 'Ya existe un usuario con ese correo electrónico'
          })
        }
      }

      // Actualizar campos
      if (data.name) provider.name = data.name
      if (data.lastName) provider.lastName = data.lastName
      if (data.email) provider.email = data.email
      if (data.birthDate) provider.birthDate = DateTime.fromSQL(data.birthDate)

      await provider.save()

      // Recargar con relaciones
      await provider.load('role')

      console.log('✅ Proveedor actualizado:', provider.email)

      return response.ok({
        message: 'Proveedor actualizado correctamente',
        provider: {
          id: provider.id,
          name: provider.name,
          lastName: provider.lastName,
          email: provider.email,
          birthDate: provider.birthDate,
          role: provider.role?.name,
          createdAt: provider.createdAt,
          updatedAt: provider.updatedAt,
        }
      })
    } catch (error) {
      console.error('❌ Error al actualizar proveedor:', error)
      return response.badRequest({
        message: 'Error al actualizar el proveedor',
        errors: error.messages || error.message
      })
    }
  }

  /**
   * Eliminar un proveedor
   */
  async destroy({ params, response }: HttpContext) {
    try {
      console.log('🗑️ Eliminando proveedor ID:', params.id)
      
      const provider = await User.query()
        .where('id', params.id)
        .where('role_id', 2) // Verificar que sea proveedor
        .first()

      if (!provider) {
        return response.notFound({
          message: 'Proveedor no encontrado'
        })
      }

      // Verificar si el proveedor tiene cajas asignadas usando query directa
      const SafeBox = (await import('#models/safe_box')).default
      const boxesCount = await SafeBox.query()
        .where('provider_id', provider.id)
        .count('id as total')
      
      const totalBoxes = boxesCount[0].$extras.total
      
      if (totalBoxes > 0) {
        return response.badRequest({
          message: `No se puede eliminar el proveedor porque tiene ${totalBoxes} caja(s) asignada(s)`
        })
      }

      const providerName = `${provider.name} ${provider.lastName}`
      await provider.delete()

      console.log('✅ Proveedor eliminado:', providerName)

      return response.ok({
        message: `Proveedor ${providerName} eliminado correctamente`
      })
    } catch (error) {
      console.error('❌ Error al eliminar proveedor:', error)
      return response.internalServerError({
        message: 'Error al eliminar el proveedor',
        error: error.message
      })
    }
  }
}
