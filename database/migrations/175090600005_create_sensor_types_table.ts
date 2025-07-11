import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sensor_types'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 50).notNullable().unique()
      table.string('description').nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    // Insertar tipos de sensores predeterminados
    this.defer(async (db) => {
      await db.table('sensor_types').insert([
        { name: 'temperature', description: 'Sensor de temperatura' },
        { name: 'humidity', description: 'Sensor de humedad' },
        { name: 'weight', description: 'Sensor de peso' }
      ])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}