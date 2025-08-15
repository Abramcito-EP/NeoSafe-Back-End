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
        // Los administradores solo pueden ver cajas NO reclamadas
        boxes = await SafeBox.query().where('is_claimed', false);
      } else if (user.role.name === 'provider') {
        // Los proveedores solo pueden ver cajas NO reclamadas que proporcionan
        boxes = await SafeBox.query()
          .where('provider_id', user.id)
          .where('is_claimed', false);
      } else {
        // Los usuarios normales solo pueden ver sus propias cajas reclamadas
        boxes = await SafeBox.query()
          .where('owner_id', user.id)
          .where('is_claimed', true);
      }

      console.log(`📦 Usuario ${user.id} (${user.role.name}) tiene ${boxes.length} cajas`);
      
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
      if (user.role.name === 'user') {
        // Los usuarios solo pueden ver sus propias cajas reclamadas
        if (!box.isClaimed || box.ownerId !== user.id) {
          return response.forbidden({ message: 'No tienes permiso para ver esta caja' })
        }
      } else if (user.role.name === 'provider') {
        // Los proveedores solo pueden ver cajas NO reclamadas que proporcionan
        if (box.isClaimed || box.providerId !== user.id) {
          return response.forbidden({ message: 'No tienes permiso para ver esta caja' })
        }
      } else if (user.role.name === 'admin') {
        // Los administradores solo pueden ver cajas NO reclamadas
        if (box.isClaimed) {
          return response.forbidden({ message: 'No tienes permiso para ver esta caja reclamada' })
        }
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
      
      // Validar datos de entrada
    const boxSchema = vine.compile(
      vine.object({
        name: vine.string(),
        modelId: vine.number(),
        codeNfc: vine.string().optional(),
        sensorTypes: vine.array(
        vine.string().in(['temperature', 'humidity', 'weight'])
        ).optional()
      })
    )
      
      const data = await request.validateUsing(boxSchema)
      
      // Generar un código de claim único
      let claimCode: string;
      let existingBox;
      
      do {
        claimCode = SafeBox.generateClaimCode()
        existingBox = await SafeBox.findBy('claim_code', claimCode)
      } while (existingBox)
      
      // Crear la caja fuerte
      const box = await SafeBox.create({
        name: data.name,
        modelId: data.modelId,
        codeNfc: data.codeNfc,
        claimCode: claimCode,
        isClaimed: false,
        providerId: user.id, // El creador se convierte en el proveedor
        status: 'available'
      })
      
      // Si se especificaron tipos de sensores, crearlos
      if (data.sensorTypes && data.sensorTypes.length > 0) {
        const sensorTypeMapping = {
          'temperature': 1,
          'humidity': 2,
          'weight': 3
        }
        
        const sensors = data.sensorTypes.map(type => ({
          boxId: box.id,
          sensorTypeId: sensorTypeMapping[type as keyof typeof sensorTypeMapping]
        }))
        
        await BoxSensor.createMany(sensors)
      } else {
        // Por defecto, crear los tres tipos de sensores
        await BoxSensor.createMany([
          { boxId: box.id, sensorTypeId: 1 }, // temperature
          { boxId: box.id, sensorTypeId: 2 }, // humidity
          { boxId: box.id, sensorTypeId: 3 }  // weight
        ])
      }
      
      // Cargar relaciones para la respuesta
      await box.load('provider')
      await box.load('sensors')
      
      return response.created(box)
    } catch (error) {
      return response.badRequest({
        message: 'Error al crear la caja fuerte',
        errors: error.messages || error.message
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
      
      // Validar datos de entrada
      const boxSchema = vine.compile(
        vine.object({
          name: vine.string().optional(),
          modelId: vine.number().optional(),
          codeNfc: vine.string().optional(),
          status: vine.string().in(['available', 'pending_transfer', 'transferred']).optional()
        })
      )
      
      const data = await request.validateUsing(boxSchema)
      
      // Actualizar la caja
      if (data.name) box.name = data.name
      if (data.modelId) box.modelId = data.modelId
      if (data.codeNfc) box.codeNfc = data.codeNfc
      if (data.status) box.status = data.status as 'available' | 'pending_transfer' | 'transferred'
      
      await box.save()
      
      // Cargar relaciones para la respuesta
      await box.load('provider')
      await box.load('owner')
      await box.load('sensors')
      
      return response.ok(box)
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.badRequest({
        message: 'Error al actualizar la caja fuerte',
        errors: error.messages || error.message
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
      
      // Verificar que la caja no ha sido reclamada
      if (box.isClaimed) {
        return response.badRequest({ 
          message: 'Esta caja ya ha sido reclamada' 
        })
      }
      
      // El código ya debería existir desde la creación de la caja
      // Si no existe, generar uno nuevo
      if (!box.claimCode) {
        let claimCode;
        let existingBox;
        
        do {
          claimCode = SafeBox.generateClaimCode()
          existingBox = await SafeBox.findBy('claim_code', claimCode)
        } while (existingBox)
        
        // Actualizar la caja con el código
        box.claimCode = claimCode
        await box.save()
      }
      
      return response.ok({
        message: 'Código de propiedad disponible',
        claimCode: box.claimCode,
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
   * Reclamar una caja con código de propiedad
   */
  async claimBoxWithCode({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // Validar la entrada
      const validator = vine.compile(
        vine.object({
          claimCode: vine.string().trim().minLength(1)
        })
      )
      
      const { claimCode } = await request.validateUsing(validator)
      
      console.log(`🔍 Usuario ${user.id} intentando reclamar caja con código: ${claimCode}`)
      
      // Buscar la caja con el código proporcionado (usar claim_code que es la columna real)
      const box = await SafeBox.query()
        .where('claim_code', claimCode)
        .where('is_claimed', false) // Usar is_claimed en lugar de owner_id
        .first()
      
      if (!box) {
        console.log(`❌ No se encontró caja disponible con código: ${claimCode}`)
        return response.badRequest({
          message: 'Código inválido o la caja ya ha sido reclamada'
        })
      }
      
      // Asignar la caja al usuario
      box.ownerId = user.id
      box.isClaimed = true // Marcar como reclamada
      await box.save()
      
      console.log(`✅ Caja ${box.id} (${box.name}) reclamada exitosamente por usuario ${user.id}`)
      
      return response.ok({
        message: 'Caja reclamada exitosamente',
        box: {
          id: box.id,
          name: box.name,
          modelId: box.modelId,
          status: box.status,
          isClaimed: box.isClaimed,
          ownerId: box.ownerId
        }
      })
      
    } catch (error) {
      console.error('❌ Error reclamando caja:', error)
      return response.internalServerError({
        message: 'Error al reclamar la caja',
        error: error.message
      })
    }
  }
}
