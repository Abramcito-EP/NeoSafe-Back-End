import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'safe_boxes'

  public async up() {
    // Generar códigos únicos para cajas existentes
    this.defer(async (db) => {
      const boxes = await db.from(this.tableName).select('id', 'owner_id')
      
      for (const box of boxes) {
        let claimCode: string = ''
        let isUnique = false
        
        // Generar código único
        while (!isUnique) {
          claimCode = this.generateClaimCode()
          const existing = await db.from(this.tableName)
            .where('claim_code', claimCode)
            .first()
          
          if (!existing) {
            isUnique = true
          }
        }
        
        await db.from(this.tableName)
          .where('id', box.id)
          .update({ 
            claim_code: claimCode,
            is_claimed: box.owner_id ? true : false
          })
      }
    })
  }

  public async down() {
    // No es necesario hacer nada en el rollback
    // ya que la migración anterior se encarga de eliminar la columna
  }

  private generateClaimCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}