import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 50).notNullable().unique()
      table.string('description').nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    // Insertar roles predeterminados
    this.defer(async (db) => {
      await db.table('roles').insert([
        { name: 'admin', description: 'Administrador del sistema' },
        { name: 'provider', description: 'Proveedor de cajas fuertes' },
        { name: 'user', description: 'Usuario regular' }
      ])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}