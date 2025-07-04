import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SafeBox from './safe_box.js'

export default class BoxSensor extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'box_id' })
  declare boxId: number

  @column()
  declare type: 'temperature' | 'humidity' | 'weight'

  @column()
  declare model: string | null

  @column({ columnName: 'serial_number' })
  declare serialNumber: string | null

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @column()
  declare config: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => SafeBox)
  declare safeBox: BelongsTo<typeof SafeBox>
}