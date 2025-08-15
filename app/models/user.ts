import { DateTime } from 'luxon'
import { withAuthFinder } from '@adonisjs/auth'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Role from './role.js'
import SafeBox from './safe_box.js'

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

  @column()
  declare roleId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Role)
  declare role: BelongsTo<typeof Role>

  @hasMany(() => SafeBox, {
    foreignKey: 'owner_id',
  })
  declare ownedBoxes: HasMany<typeof SafeBox>

  @hasMany(() => SafeBox, {
    foreignKey: 'provider_id',
  })
  declare providedBoxes: HasMany<typeof SafeBox>

  static accessTokens = DbAccessTokensProvider.forModel(User)
    user: Date
}