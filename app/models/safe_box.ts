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

  @column({ columnName: 'model_id' })
  declare modelId: number

  @column({ columnName: 'code_nfc' })
  declare codeNfc: string | null

  @column({ columnName: 'claim_code' })
  declare claimCode: string

  @column({ columnName: 'is_claimed' })
  declare isClaimed: boolean

  @column({ columnName: 'owner_id' })
  declare ownerId: number | null

  @column({ columnName: 'provider_id' })
  declare providerId: number

  @column()
  declare status: 'available' | 'pending_transfer' | 'transferred'

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'ownerId',
  })
  declare owner: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'providerId',
  })
  declare provider: BelongsTo<typeof User>

  @hasMany(() => BoxSensor, {
    foreignKey: 'boxId'
  })
  declare sensors: HasMany<typeof BoxSensor>

  @hasMany(() => BoxTransferRequest, {
    foreignKey: 'boxId'
  })
  declare transferRequests: HasMany<typeof BoxTransferRequest>

  // Método para generar un código de reclamo aleatorio de 8 caracteres
  static generateClaimCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
  }
}