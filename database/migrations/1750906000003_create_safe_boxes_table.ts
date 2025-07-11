import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'safe_boxes'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
      table.integer('model_id').unsigned().references('id').inTable('box_models').notNullable()
      table.string('code_nfc').nullable().unique()
      table.string('claim_code', 8).notNullable().unique()
      table.boolean('is_claimed').defaultTo(false)
      table.integer('owner_id').unsigned().references('id').inTable('users').nullable()
      table.integer('provider_id').unsigned().references('id').inTable('users').notNullable()
      table.enum('status', ['available', 'pending_transfer', 'transferred']).defaultTo('available')
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}