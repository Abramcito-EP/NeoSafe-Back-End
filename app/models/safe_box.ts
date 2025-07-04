import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import BoxSensor from './box_sensor.js'
import BoxTransferRequest from './box_transfer_request.js'

export default class SafeBox extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare model: string

  @column({ columnName: 'serial_number' })
  declare serialNumber: string

  @column({ columnName: 'property_code' })
  declare propertyCode: string | null

  @column({ columnName: 'owner_id' })
  declare ownerId: number | null

  @column({ columnName: 'provider_id' })
  declare providerId: number

  @column()
  declare status: 'available' | 'pending_transfer' | 'transferred'

  @column.dateTime({ columnName: 'transfer_requested_at' })
  declare transferRequestedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'owner_id',
  })
  declare owner: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'provider_id',
  })
  declare provider: BelongsTo<typeof User>

  @hasMany(() => BoxSensor)
  declare sensors: HasMany<typeof BoxSensor>

  @hasMany(() => BoxTransferRequest)
  declare transferRequests: HasMany<typeof BoxTransferRequest>

  // Método para generar un código de propiedad aleatorio de 6 caracteres
  static generatePropertyCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
  }
}