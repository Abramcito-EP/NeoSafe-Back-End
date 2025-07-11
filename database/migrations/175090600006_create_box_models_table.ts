import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'box_models'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 100).notNullable().unique()
      table.string('description').nullable()
      table.decimal('max_weight', 8, 2).nullable()
      table.decimal('dimensions_width', 8, 2).nullable()
      table.decimal('dimensions_height', 8, 2).nullable()
      table.decimal('dimensions_depth', 8, 2).nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    // Insertar algunos modelos predeterminados
    this.defer(async (db) => {
      await db.table('box_models').insert([
        { name: 'NeoSafe Basic', description: 'Modelo básico de caja fuerte' },
        { name: 'NeoSafe Pro', description: 'Modelo profesional con sensores avanzados' },
        { name: 'NeoSafe Premium', description: 'Modelo premium con máximas características' }
      ])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}