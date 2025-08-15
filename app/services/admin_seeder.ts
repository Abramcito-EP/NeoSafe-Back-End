import User from '#models/user'
import { DateTime } from 'luxon'

export default class AdminSeeder {
  /**
   * Crear cuenta de administrador por defecto
   */
  static async createAdminUser() {
    try {
      console.log('🔑 Creando cuenta de administrador...')

      // Verificar si ya existe un administrador
      const existingAdmin = await User.query()
        .where('email', 'admin@neosafe.com')
        .first()

      if (existingAdmin) {
        console.log('✅ Ya existe una cuenta de administrador con email: admin@neosafe.com')
        return existingAdmin
      }

      // Crear la cuenta de administrador
      const adminUser = await User.create({
        name: 'Administrador',
        lastName: 'Sistema',
        email: 'admin@neosafe.com',
        password: 'admin123',  // Será hasheada automáticamente por el modelo
        birthDate: DateTime.fromFormat('1990-01-01', 'yyyy-MM-dd'),
        roleId: 1 // admin
      })

      console.log('✅ Cuenta de administrador creada exitosamente:')
      console.log(`   📧 Email: ${adminUser.email}`)
      console.log(`   🔐 Contraseña: admin123`)
      console.log(`   👤 Nombre: ${adminUser.name} ${adminUser.lastName}`)
      
      return adminUser

    } catch (error) {
      console.error('❌ Error al crear cuenta de administrador:', error)
      throw error
    }
  }

  /**
   * Crear múltiples cuentas de administrador para pruebas
   */
  static async createTestAdmins() {
    try {
      console.log('🔑 Creando cuentas de administrador de prueba...')

      const testAdmins = [
        {
          name: 'Admin Principal',
          lastName: 'Sistema',
          email: 'admin@neosafe.com',
          password: 'admin123',
          birthDate: DateTime.fromFormat('1990-01-01', 'yyyy-MM-dd'),
          roleId: 1 // admin
        },
        {
          name: 'Super Admin',
          lastName: 'NeoSafe',
          email: 'superadmin@neosafe.com',
          password: 'superadmin123',
          birthDate: DateTime.fromFormat('1985-06-15', 'yyyy-MM-dd'),
          roleId: 1 // admin
        },
        {
          name: 'Test Admin',
          lastName: 'Desarrollo',
          email: 'testadmin@neosafe.com',
          password: 'testadmin123',
          birthDate: DateTime.fromFormat('1992-12-25', 'yyyy-MM-dd'),
          roleId: 1 // admin
        }
      ]

      const createdAdmins = []

      for (const adminData of testAdmins) {
        // Verificar si ya existe
        const existingAdmin = await User.query()
          .where('email', adminData.email)
          .first()

        if (existingAdmin) {
          console.log(`⚠️  Admin ya existe: ${adminData.email}`)
          createdAdmins.push(existingAdmin)
          continue
        }

        // Crear nuevo admin
        const admin = await User.create(adminData)
        createdAdmins.push(admin)
        
        console.log(`✅ Admin creado: ${admin.name} ${admin.lastName} (${admin.email})`)
      }

      console.log(`🎉 Proceso completado. ${createdAdmins.length} administradores disponibles.`)
      console.log('')
      console.log('📋 Credenciales de acceso:')
      console.log('┌─────────────────────────────────────────────────────────────┐')
      console.log('│                    CUENTAS DE ADMINISTRADOR                 │')
      console.log('├─────────────────────────────────────────────────────────────┤')
      testAdmins.forEach(admin => {
        console.log(`│ 📧 ${admin.email.padEnd(25)} 🔐 ${admin.password.padEnd(15)} │`)
      })
      console.log('└─────────────────────────────────────────────────────────────┘')
      
      return createdAdmins

    } catch (error) {
      console.error('❌ Error al crear administradores de prueba:', error)
      throw error
    }
  }

  /**
   * Eliminar todos los administradores (útil para testing)
   */
  static async deleteAllAdmins() {
    try {
      console.log('🗑️  Eliminando todas las cuentas de administrador...')
      
      const admins = await User.query().where('role_id', 1)
      const count = admins.length
      
      await User.query().where('role_id', 1).delete()
      
      console.log(`✅ ${count} cuentas de administrador eliminadas.`)
      
    } catch (error) {
      console.error('❌ Error al eliminar administradores:', error)
      throw error
    }
  }
}
