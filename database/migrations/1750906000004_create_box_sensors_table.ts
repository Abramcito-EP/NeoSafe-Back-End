import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'box_sensors'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('box_id').unsigned().references('id').inTable('safe_boxes').onDelete('CASCADE')
      table.integer('sensor_type_id').unsigned().references('id').inTable('sensor_types').notNullable()
      table.string('serial_number').nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
      
      // Índice compuesto para asegurarse que una caja no tenga duplicados del mismo tipo de sensor
      table.unique(['box_id', 'sensor_type_id'])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}