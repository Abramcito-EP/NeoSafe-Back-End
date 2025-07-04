import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'box_transfer_requests'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('box_id').unsigned().references('id').inTable('safe_boxes').onDelete('CASCADE')
      table.integer('requestor_id').unsigned().references('id').inTable('users')
      table.integer('provider_id').unsigned().references('id').inTable('users')
      table.string('property_code', 6).notNullable()
      table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending')
      table.text('notes').nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}