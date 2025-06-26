import { DateTime } from 'luxon'
import { withAuthFinder } from '@adonisjs/auth'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column({ columnName: 'last_name' })
  declare lastName: string

  @column.date({ columnName: 'birth_date' })
  declare birthDate: DateTime

  @column()
  declare email: string

  @column()
  declare password: string

  @column({ columnName: 'remember_me_token' })
  declare rememberMeToken?: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  static accessTokens = DbAccessTokensProvider.forModel(User)
}