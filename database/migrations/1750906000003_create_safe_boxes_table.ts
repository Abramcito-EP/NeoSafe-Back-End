import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'safe_boxes'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.string('model').notNullable()
      table.string('serial_number').notNullable().unique()
      table.string('property_code', 6).nullable().unique()
      table.integer('owner_id').unsigned().references('id').inTable('users').nullable()
      table.integer('provider_id').unsigned().references('id').inTable('users').notNullable()
      table.enum('status', ['available', 'pending_transfer', 'transferred']).defaultTo('available')
      table.timestamp('transfer_requested_at').nullable()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}