import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  public async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('name', 50).notNullable().unique()
      
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).defaultTo(this.now())
    })

    this.defer(async (db) => {
      await db.table('roles').insert([
        { name: 'admin'},
        { name: 'provider'},
        { name: 'user'}
      ])
    })
  }

  public async down() {
    this.schema.dropTable(this.tableName)
  }
}