import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from './user.js'
import SafeBox from './safe_box.js'

export default class BoxTransferRequest extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'box_id' })
  declare boxId: number

  @column({ columnName: 'requestor_id' })
  declare requestorId: number

  @column({ columnName: 'provider_id' })
  declare providerId: number

  @column({ columnName: 'property_code' })
  declare propertyCode: string

  @column()
  declare status: 'pending' | 'approved' | 'rejected'

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => SafeBox)
  declare safeBox: BelongsTo<typeof SafeBox>

  @belongsTo(() => User, {
    foreignKey: 'requestor_id',
  })
  declare requestor: BelongsTo<typeof User>

  @belongsTo(() => User, {
    foreignKey: 'provider_id',
  })
  declare provider: BelongsTo<typeof User>
}