import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import SafeBox from './safe_box.js'

export default class BoxSensor extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'box_id' })
  declare boxId: number

  @column({ columnName: 'sensor_type_id' })
  declare sensorTypeId: number

  @column({ columnName: 'serial_number' })
  declare serialNumber: string | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => SafeBox, {
    foreignKey: 'boxId',
  })
  declare box: BelongsTo<typeof SafeBox>
}
