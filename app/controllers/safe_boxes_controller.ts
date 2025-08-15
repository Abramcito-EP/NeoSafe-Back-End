import { HttpContext } from '@adonisjs/core/http'
import SafeBox from '#models/safe_box'
import BoxSensor from '#models/box_sensor'
import vine from '@vinejs/vine'

export default class SafeBoxesController {
  /**
   * Esquemas de validación reutilizables
   */
  private static readonly schemas = {
    create: vine.compile(vine.object({
      name: vine.string().trim().minLength(1).maxLength(255),
      modelId: vine.number().positive().optional(),
      codeNfc: vine.string().trim().optional(),
      sensorTypes: vine.array(vine.string().in(['temperature', 'humidity'])).optional()
    })),
    
    update: vine.compile(vine.object({
      name: vine.string().trim().minLength(1).maxLength(100).optional(),
      status: vine.string().in(['available', 'pending_transfer', 'transferred']).optional()
    })),
    
    claim: vine.compile(vine.object({
      claimCode: vine.string().trim().minLength(8).maxLength(8)
    }))
  }

  /**
   * Mapeo de tipos de sensores a IDs
   */
  private static readonly sensorTypeIds = {
    temperature: 1,
    humidity: 2
  }

  /**
   * Verificar permisos de acceso a una caja
   */
  private checkPermissions(user: any, box: SafeBox, operation: 'view' | 'modify') {
    const { role } = user
    
    switch (role.name) {
      case 'admin':
        return !box.isClaimed
      case 'provider':
        return box.providerId === user.id && !box.isClaimed
      case 'user':
        return operation === 'view' ? (box.ownerId === user.id && box.isClaimed) : false
      default:
        return false
    }
  }

  /**
   * Generar código de reclamo único
   */
  private async generateUniqueClaimCode(): Promise<string> {
    let claimCode: string
    let existingBox: SafeBox | null
    
    do {
      claimCode = SafeBox.generateClaimCode()
      existingBox = await SafeBox.findBy('claimCode', claimCode)
    } while (existingBox)
    
    return claimCode
  }

  /**
   * Crear sensores por defecto para una caja
   */
  private async createSensors(boxId: number, sensorTypes?: string[]): Promise<void> {
    const types = sensorTypes?.length ? sensorTypes : ['temperature', 'humidity']
    const sensors = types.map(type => ({
      boxId,
      sensorTypeId: SafeBoxesController.sensorTypeIds[type as keyof typeof SafeBoxesController.sensorTypeIds] || 1,
      serialNumber: `${type.toUpperCase()}-${boxId}-${Date.now()}`
    }))
    
    await BoxSensor.createMany(sensors)
  }

  /**
   * Formatear respuesta de caja
   */
  private formatBoxResponse(box: SafeBox) {
    return {
      id: box.id,
      name: box.name,
      modelId: box.modelId,
      codeNfc: box.codeNfc,
      claimCode: box.isClaimed ? null : box.claimCode,
      isClaimed: box.isClaimed,
      ownerId: box.ownerId,
      providerId: box.providerId,
      status: box.status,
      createdAt: box.createdAt,
      updatedAt: box.updatedAt,
      owner: box.owner,
      provider: box.provider,
      sensors: box.sensors
    }
  }

  /**
   * Obtener todas las cajas (filtradas según el rol del usuario)
   */
  async index({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')

      const baseQuery = SafeBox.query()

      // Aplicar filtros según rol
      switch (user.role.name) {
        case 'admin':
          baseQuery.where('is_claimed', false).preload('provider')
          break
        case 'provider':
          baseQuery.where('provider_id', user.id).where('is_claimed', false)
          break
        case 'user':
          baseQuery.where('owner_id', user.id).where('is_claimed', true).preload('provider')
          break
      }

      const boxes = await baseQuery.preload('sensors')
      const formattedBoxes = boxes.map(box => this.formatBoxResponse(box))

      return response.ok(formattedBoxes)
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
      
      if (!this.checkPermissions(user, box, 'view')) {
        return response.forbidden({ 
          message: user.role.name === 'admin' 
            ? 'Esta caja ya ha sido reclamada y no es accesible'
            : 'No tienes permiso para ver esta caja' 
        })
      }

      await box.load('owner')
      await box.load('provider')
      await box.load('sensors')
      return response.ok(this.formatBoxResponse(box))
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
      
      if (!['admin', 'provider'].includes(user.role.name)) {
        return response.forbidden({ message: 'No tienes permiso para crear cajas fuertes' })
      }
      
      const data = await request.validateUsing(SafeBoxesController.schemas.create)
      const claimCode = await this.generateUniqueClaimCode()
      
      const box = await SafeBox.create({
        name: data.name,
        modelId: data.modelId || 1,
        codeNfc: data.codeNfc || null,
        claimCode,
        isClaimed: false,
        providerId: user.id,
        status: 'available'
      })
      
      await this.createSensors(box.id, data.sensorTypes)
      
      return response.created(this.formatBoxResponse(box))
    } catch (error) {
      console.error('Error al crear caja fuerte:', error)
      
      return response.badRequest({
        message: error.messages ? 'Error de validación' : 'Error al crear la caja fuerte',
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
      
      if (!this.checkPermissions(user, box, 'modify')) {
        const message = user.role.name === 'admin' 
          ? 'No se puede actualizar una caja que ya ha sido reclamada'
          : user.role.name === 'user'
          ? 'Los usuarios regulares no pueden actualizar cajas'
          : 'No tienes permiso para actualizar esta caja o ya ha sido reclamada'
        
        return response.forbidden({ message })
      }
      
      const data = await request.validateUsing(SafeBoxesController.schemas.update)
      
      Object.assign(box, data)
      await box.save()
      await box.load('provider')
      await box.load('owner')
      await box.load('sensors')
      
      return response.ok(box)
    } catch (error) {
      console.error('Error al actualizar caja fuerte:', error)
      
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ message: 'Caja fuerte no encontrada' })
      }
      
      return response.badRequest({
        message: error.messages ? 'Error de validación' : 'Error al actualizar la caja fuerte',
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
      
      if (!this.checkPermissions(user, box, 'modify')) {
        const message = user.role.name === 'admin'
          ? 'No se puede eliminar una caja que ya ha sido reclamada'
          : user.role.name === 'user'
          ? 'Los usuarios regulares no pueden eliminar cajas'
          : 'No tienes permiso para eliminar esta caja o ya ha sido reclamada'
        
        return response.forbidden({ message })
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
   * Reclamar una caja fuerte usando un código de reclamo
   */
  async claimBox({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
      
      const { claimCode } = await request.validateUsing(SafeBoxesController.schemas.claim)
      
      const box = await SafeBox.findBy('claimCode', claimCode)
      
      if (!box) {
        return response.notFound({ message: 'Código de reclamo no válido o no encontrado' })
      }
      
      // Validaciones de negocio
      const validations = [
        { condition: box.isClaimed, message: 'Esta caja ya ha sido reclamada por otro usuario' },
        { condition: box.status !== 'available', message: 'Esta caja no está disponible para reclamo' }
      ]
      
      for (const { condition, message } of validations) {
        if (condition) {
          return response.badRequest({ message })
        }
      }
      
      // Reclamar la caja
      Object.assign(box, {
        ownerId: user.id,
        isClaimed: true,
        status: 'transferred'
      })
      await box.save()
      
      await box.load('owner')
      await box.load('provider')
      await box.load('sensors')
      
      return response.ok({
        message: 'Caja reclamada con éxito',
        box: this.formatBoxResponse(box)
      })
    } catch (error) {
      console.error('Error al reclamar caja fuerte:', error)
      
      return response.internalServerError({
        message: error.messages ? 'Error de validación' : 'Error al reclamar la caja fuerte',
        errors: error.messages || error.message
      })
    }
  }
}