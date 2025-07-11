import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'safe_boxes'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Eliminar columnas que ya no necesitamos
      table.dropColumn('property_code')
      table.dropColumn('status')
      table.dropColumn('transfer_requested_at')
      
      // Agregar nueva columna para el código de reclamación
      table.string('claim_code', 8).notNullable().unique()
      
      // Modificar owner_id para que sea nullable y permitir cajas sin dueño
      table.boolean('is_claimed').defaultTo(false)
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Restaurar columnas eliminadas
      table.string('property_code', 6).nullable().unique()
      table.enum('status', ['available', 'pending_transfer', 'transferred']).defaultTo('available')
      table.timestamp('transfer_requested_at').nullable()
      
      // Eliminar nuevas columnas
      table.dropColumn('claim_code')
      table.dropColumn('is_claimed')
    })
  }
}