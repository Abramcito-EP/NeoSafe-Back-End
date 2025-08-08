import { HttpContext } from '@adonisjs/core/http'
import SafeBox from '#models/safe_box'
import BoxSensor from '#models/box_sensor'
import vine from '@vinejs/vine'

export default class SafeBoxesController {
  /**
   * Obtener todas las cajas (filtradas según el rol del usuario)
   */
  async index({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')

      let boxes;

      if (user.role.name === 'admin') {
        // Los administradores pueden ver todas las cajas
        boxes = await SafeBox.query()
          .preload('owner')
          .preload('provider')
          .preload('sensors');
      } else if (user.role.name === 'provider') {
        // Los proveedores pueden ver las cajas que proporcionan
        boxes = await SafeBox.query()
          .where('provider_id', user.id)
          .preload('owner')
          .preload('sensors');
      } else {
        // Los usuarios normales solo pueden ver sus propias cajas
        boxes = await SafeBox.query()
          .where('owner_id', user.id)
          .preload('provider')
          .preload('sensors');
      }

      return response.ok(boxes);
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener las cajas fuertes',
        error: error.message
      })
    }
  }

  /**
   * Obtener una caja específica por ID
   */
  async show({ params, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')

      const box = await SafeBox.findOrFail(id)
      
      // Verificar permisos según el rol
      if (user.role.name === 'user' && box.ownerId !== user.id) {
        return response.forbidden({ message: 'No tienes permiso para ver esta caja' })
      }
      
      if (user.role.name === 'provider' && box.providerId !== user.id) {
        return response.forbidden({ message: 'No tienes permiso para ver esta caja' })
      }

      await box.load('owner')
      await box.load('provider')
      await box.load('sensors')

      return response.ok(box)
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.internalServerError({
        message: 'Error al obtener la caja fuerte',
        error: error.message
      })
    }
  }

  /**
   * Crear una nueva caja fuerte (solo admin o provider)
   */
  async store({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
      
      // Solo los administradores y proveedores pueden crear cajas
      if (!['admin', 'provider'].includes(user.role.name)) {
        return response.forbidden({ message: 'No tienes permiso para crear cajas fuertes' })
      }
      
      // Validar datos de entrada - Ajustar a tu estructura
      const boxSchema = vine.compile(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(255),
          modelId: vine.number().positive().optional(),
          codeNfc: vine.string().trim().optional(),
          sensorTypes: vine.array(
            vine.string().in(['temperature', 'humidity', 'weight'])
          ).optional()
        })
      )
      
      const data = await request.validateUsing(boxSchema)
      
      // Generar código de reclamo único
      let claimCode;
      let existingBox;
      
      do {
        claimCode = SafeBox.generateClaimCode()
        existingBox = await SafeBox.findBy('claimCode', claimCode)
      } while (existingBox)
      
      // Crear la caja fuerte
      const box = await SafeBox.create({
        name: data.name,
        modelId: data.modelId || 1, // Asignar un modelo por defecto
        codeNfc: data.codeNfc || null,
        claimCode: claimCode,
        isClaimed: false,
        providerId: user.id, // El creador se convierte en el proveedor
        status: 'available'
      })
      
      // Crear sensores con la nueva estructura (usando sensor_type_id)
      if (data.sensorTypes && data.sensorTypes.length > 0) {
        const sensors = data.sensorTypes.map(type => {
          // Mapear tipos de sensores a IDs (deberías tener estos IDs en tu tabla sensor_types)
          let sensorTypeId;
          switch (type) {
            case 'temperature': sensorTypeId = 1; break;
            case 'humidity': sensorTypeId = 2; break;
            case 'weight': sensorTypeId = 3; break;
            default: sensorTypeId = 1;
          }
          
          return {
            boxId: box.id,
            sensorTypeId: sensorTypeId,
            serialNumber: `${type.toUpperCase()}-${box.id}-${Date.now()}`
          }
        })
        
        await BoxSensor.createMany(sensors)
      } else {
        // Por defecto, crear los tres tipos de sensores
        await BoxSensor.createMany([
          { 
            boxId: box.id, 
            sensorTypeId: 1, // temperature
            serialNumber: `TEMP-${box.id}-${Date.now()}`
          },
          { 
            boxId: box.id, 
            sensorTypeId: 2, // humidity
            serialNumber: `HUM-${box.id}-${Date.now()}`
          },
          { 
            boxId: box.id, 
            sensorTypeId: 3, // weight
            serialNumber: `WEIGHT-${box.id}-${Date.now()}`
          }
        ])
      }
      
      // Temporalmente comentar la carga de relaciones hasta que funcione
      // await box.load('provider')
      // await box.load('sensors')
      
      return response.created({
        id: box.id,
        name: box.name,
        modelId: box.modelId,
        codeNfc: box.codeNfc,
        claimCode: box.claimCode,
        isClaimed: box.isClaimed,
        providerId: box.providerId,
        status: box.status,
        createdAt: box.createdAt,
        updatedAt: box.updatedAt
      })
    } catch (error) {
      console.error('Error al crear caja fuerte:', error)
      
      if (error.messages) {
        // Error de validación de Vine
        return response.badRequest({
          message: 'Error de validación',
          errors: error.messages
        })
      }
      
      return response.badRequest({
        message: 'Error al crear la caja fuerte',
        error: error.message
      })
    }
  }

  /**
   * Actualizar una caja fuerte existente
   */
  async update({ params, request, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')
      
      const box = await SafeBox.findOrFail(id)
      
      // Verificar permisos
      if (user.role.name === 'provider' && box.providerId !== user.id) {
        return response.forbidden({ message: 'No tienes permiso para actualizar esta caja' })
      }
      
      if (user.role.name === 'user') {
        return response.forbidden({ message: 'Los usuarios regulares no pueden actualizar cajas' })
      }
      
      // Validar datos de entrada - Corregir la validación
      const boxSchema = vine.compile(
        vine.object({
          name: vine.string().trim().minLength(1).maxLength(100).optional(),
          model: vine.string().trim().minLength(1).maxLength(100).optional(),
          serialNumber: vine.string().trim().minLength(1).maxLength(50).optional(),
          status: vine.string().in(['available', 'pending_transfer', 'transferred']).optional()
        })
      )
      
      const data = await request.validateUsing(boxSchema)
      
      // Actualizar la caja
      if (data.name) box.name = data.name
      if (data.model) box.model = data.model
      if (data.serialNumber) box.serialNumber = data.serialNumber
      if (data.status) box.status = data.status as 'available' | 'pending_transfer' | 'transferred'
      
      await box.save()
      
      // Cargar relaciones para la respuesta
      await box.load('provider')
      await box.load('owner')
      await box.load('sensors')
      
      return response.ok(box)
    } catch (error) {
      console.error('Error al actualizar caja fuerte:', error)
      
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      if (error.messages) {
        return response.badRequest({
          message: 'Error de validación',
          errors: error.messages
        })
      }
      
      return response.badRequest({
        message: 'Error al actualizar la caja fuerte',
        error: error.message
      })
    }
  }

  /**
   * Eliminar una caja fuerte (solo admin o provider propietario)
   */
  async destroy({ params, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')
      
      const box = await SafeBox.findOrFail(id)
      
      // Verificar permisos
      if (user.role.name === 'provider' && box.providerId !== user.id) {
        return response.forbidden({ message: 'No tienes permiso para eliminar esta caja' })
      }
      
      if (user.role.name === 'user') {
        return response.forbidden({ message: 'Los usuarios regulares no pueden eliminar cajas' })
      }
      
      // Si la caja ya está transferida, no se puede eliminar
      if (box.status === 'transferred' && box.ownerId) {
        return response.forbidden({ 
          message: 'No se puede eliminar una caja que ya ha sido transferida a un usuario' 
        })
      }
      
      await box.delete()
      
      return response.ok({ message: 'Caja fuerte eliminada correctamente' })
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.internalServerError({
        message: 'Error al eliminar la caja fuerte',
        error: error.message
      })
    }
  }
  
  /**
   * Generar código de propiedad para una caja (solo provider dueño de la caja)
   */
  async generatePropertyCode({ params, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')
      
      // Solo los proveedores pueden generar códigos
      if (user.role.name !== 'provider') {
        return response.forbidden({ message: 'Solo los proveedores pueden generar códigos de propiedad' })
      }
      
      const box = await SafeBox.findOrFail(id)
      
      // Verificar que la caja pertenece al proveedor
      if (box.providerId !== user.id) {
        return response.forbidden({ message: 'No eres el proveedor de esta caja' })
      }
      
      // Verificar que la caja está disponible
      if (box.status !== 'available') {
        return response.badRequest({ 
          message: 'Solo se pueden generar códigos para cajas disponibles' 
        })
      }
      
      // Verificar que la caja no tiene propietario
      if (box.ownerId) {
        return response.badRequest({ 
          message: 'Esta caja ya tiene un propietario' 
        })
      }
      
      // Generar código único
      let propertyCode;
      let existingBox;
      
      do {
        propertyCode = SafeBox.generatePropertyCode()
        existingBox = await SafeBox.findBy('property_code', propertyCode)
      } while (existingBox)
      
      // Actualizar la caja con el código
      box.propertyCode = propertyCode
      await box.save()
      
      return response.ok({
        message: 'Código de propiedad generado con éxito',
        propertyCode,
        box
      })
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.internalServerError({
        message: 'Error al generar el código de propiedad',
        error: error.message
      })
    }
  }

  /**
   * Generar código de reclamo para una caja (solo provider dueño de la caja)
   */
  async generateClaimCode({ params, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')
      
      // Solo los proveedores pueden generar códigos
      if (user.role.name !== 'provider') {
        return response.forbidden({ message: 'Solo los proveedores pueden generar códigos de reclamo' })
      }
      
      const box = await SafeBox.findOrFail(id)
      
      // Verificar que la caja pertenece al proveedor
      if (box.providerId !== user.id) {
        return response.forbidden({ message: 'No eres el proveedor de esta caja' })
      }
      
      // Verificar que la caja está disponible
      if (box.status !== 'available') {
        return response.badRequest({ 
          message: 'Solo se pueden generar códigos para cajas disponibles' 
        })
      }
      
      // Verificar que la caja no ha sido reclamada
      if (box.isClaimed) {
        return response.badRequest({ 
          message: 'Esta caja ya ha sido reclamada' 
        })
      }
      
      // Generar código único
      let claimCode;
      let existingBox;
      
      do {
        claimCode = SafeBox.generateClaimCode()
        existingBox = await SafeBox.findBy('claimCode', claimCode)
      } while (existingBox)
      
      // Actualizar la caja con el código
      box.claimCode = claimCode
      await box.save()
      
      return response.ok({
        message: 'Código de reclamo generado con éxito',
        claimCode,
        box
      })
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.internalServerError({
        message: 'Error al generar el código de reclamo',
        error: error.message
      })
    }
  }
}