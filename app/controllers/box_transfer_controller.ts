import { HttpContext } from '@adonisjs/core/http'
import BoxTransferRequest from '#models/box_transfer_request'
import SafeBox from '#models/safe_box'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class BoxTransferController {
  /**
   * Usuario solicita una caja con código de propiedad
   */
  async requestBox({ request, auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // Validar datos de entrada
      const schema = vine.compile(
        vine.object({
          propertyCode: vine.string().minLength(6).maxLength(6)
        })
      )
      
      const { propertyCode } = await request.validateUsing(schema)
      
      // Buscar la caja con ese código
      const box = await SafeBox.findBy('property_code', propertyCode)
      
      if (!box) {
        return response.notFound({ 
          message: 'No se encontró una caja con ese código de propiedad' 
        })
      }
      
      // Verificar que la caja está disponible
      if (box.status !== 'available') {
        return response.badRequest({ 
          message: 'Esta caja no está disponible para transferencia' 
        })
      }
      
      // Verificar si ya existe una solicitud pendiente
      const existingRequest = await BoxTransferRequest.query()
        .where('box_id', box.id)
        .where('requestor_id', user.id)
        .where('status', 'pending')
        .first()
      
      if (existingRequest) {
        return response.badRequest({ 
          message: 'Ya tienes una solicitud pendiente para esta caja',
          request: existingRequest
        })
      }
      
      // Crear la solicitud de transferencia
      const transferRequest = await BoxTransferRequest.create({
        boxId: box.id,
        requestorId: user.id,
        providerId: box.providerId,
        propertyCode,
        status: 'pending'
      })
      
      // Actualizar el estado de la caja
      box.status = 'pending_transfer'
      box.transferRequestedAt = DateTime.now()
      await box.save()
      
      // Cargar relaciones para la respuesta
      await transferRequest.load('safeBox')
      await transferRequest.load('requestor')
      await transferRequest.load('provider')
      
      return response.created({
        message: 'Solicitud de transferencia enviada correctamente',
        request: transferRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Error al solicitar la caja',
        errors: error.messages || error.message
      })
    }
  }
  
  /**
   * Obtener solicitudes de transferencia (filtradas según el rol)
   */
  async listTransferRequests({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      await user.load('role')
      
      let requests;
      
      if (user.role.name === 'admin') {
        // Administradores ven todas las solicitudes
        requests = await BoxTransferRequest.query()
          .preload('safeBox')
          .preload('requestor')
          .preload('provider')
      } else if (user.role.name === 'provider') {
        // Proveedores ven solicitudes para sus cajas
        requests = await BoxTransferRequest.query()
          .where('provider_id', user.id)
          .preload('safeBox')
          .preload('requestor')
      } else {
        // Usuarios ven sus propias solicitudes
        requests = await BoxTransferRequest.query()
          .where('requestor_id', user.id)
          .preload('safeBox')
          .preload('provider')
      }
      
      return response.ok(requests)
    } catch (error) {
      return response.internalServerError({
        message: 'Error al obtener las solicitudes de transferencia',
        error: error.message
      })
    }
  }
  
  /**
   * Proveedor aprueba o rechaza una solicitud de transferencia
   */
  async respondToRequest({ params, request, auth, response }: HttpContext) {
    try {
      const { id } = params
      const user = auth.user!
      await user.load('role')
      
      // Solo los proveedores pueden responder a solicitudes
      if (user.role.name !== 'provider' && user.role.name !== 'admin') {
        return response.forbidden({ 
          message: 'Solo los proveedores pueden responder a solicitudes de transferencia' 
        })
      }
      
      // Validar datos de entrada
      const schema = vine.compile(
        vine.object({
          action: vine.string().in(['approve', 'reject']),
          notes: vine.string().optional()
        })
      )
      
      const { action, notes } = await request.validateUsing(schema)
      
      // Obtener la solicitud
      const transferRequest = await BoxTransferRequest.findOrFail(id)
      
      // Verificar que el proveedor es el correcto
      if (user.role.name === 'provider' && transferRequest.providerId !== user.id) {
        return response.forbidden({ 
          message: 'No eres el proveedor asociado a esta solicitud' 
        })
      }
      
      // Verificar que la solicitud está pendiente
      if (transferRequest.status !== 'pending') {
        return response.badRequest({ 
          message: 'Esta solicitud ya ha sido procesada' 
        })
      }
      
      // Obtener la caja
      const box = await SafeBox.findOrFail(transferRequest.boxId)
      
      if (action === 'approve') {
        // Aprobar la transferencia
        transferRequest.status = 'approved'
        if (notes) transferRequest.notes = notes
        await transferRequest.save()
        
        // Actualizar la caja
        box.ownerId = transferRequest.requestorId
        box.status = 'transferred'
        box.propertyCode = null // Invalidar el código una vez usado
        await box.save()
        
        return response.ok({
          message: 'Solicitud de transferencia aprobada correctamente',
          request: transferRequest
        })
      } else {
        // Rechazar la transferencia
        transferRequest.status = 'rejected'
        if (notes) transferRequest.notes = notes
        await transferRequest.save()
        
        // Revertir el estado de la caja
        box.status = 'available'
        box.transferRequestedAt = null
        await box.save()
        
        return response.ok({
          message: 'Solicitud de transferencia rechazada',
          request: transferRequest
        })
      }
    } catch (error) {
      if (error.name === 'ModelNotFoundError') {
        return response.notFound({ 
          message: 'Solicitud de transferencia no encontrada' 
        })
      }
      
      return response.internalServerError({
        message: 'Error al procesar la solicitud de transferencia',
        error: error.message
      })
    }
  }
}