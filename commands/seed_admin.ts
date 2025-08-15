import { BaseCommand } from '@adonisjs/core/ace'
import AdminSeeder from '#services/admin_seeder'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SeedAdmin extends BaseCommand {
  static commandName = 'seed:admin'
  static description = 'Crear cuentas de administrador'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const action = await this.prompt.choice('¿Qué acción deseas realizar?', [
      {
        name: 'single',
        message: 'Crear una cuenta de administrador principal (admin@neosafe.com)',
      },
      {
        name: 'multiple',
        message: 'Crear múltiples cuentas de administrador para pruebas (3 cuentas)',
      },
      {
        name: 'delete',
        message: 'Eliminar todas las cuentas de administrador ⚠️ Acción destructiva',
      }
    ])

    this.logger.info('🚀 Iniciando seeder de administradores...')

    try {
      switch (action) {
        case 'single':
          await AdminSeeder.createAdminUser()
          break
          
        case 'multiple':
          await AdminSeeder.createTestAdmins()
          break
          
        case 'delete':
          const confirmed = await this.prompt.confirm(
            '⚠️  ¿Estás seguro de que quieres eliminar TODAS las cuentas de administrador?'
          )
          
          if (confirmed) {
            await AdminSeeder.deleteAllAdmins()
          } else {
            this.logger.info('❌ Operación cancelada.')
          }
          break
      }

      this.logger.success('✅ Seeder de administradores completado exitosamente!')
      
    } catch (error) {
      this.logger.error('❌ Error en el seeder de administradores:')
      this.logger.error(error.message)
      this.exitCode = 1
    }
  }
}
