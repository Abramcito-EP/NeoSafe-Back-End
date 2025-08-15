import User from '#models/user'
import { DateTime } from 'luxon'

export default class TestProvidersSeeder {
  static async createTestProviders() {
    try {
      console.log('🌱 Creando proveedores de prueba...')

      const testProviders = [
        {
          name: 'Juan Carlos',
          lastName: 'Fernández',
          email: 'juan.fernandez@provider.com',
          password: '123456',
          birthDate: DateTime.fromFormat('1985-03-15', 'yyyy-MM-dd'),
          roleId: 2 // proveedor
        },
        {
          name: 'María Elena',
          lastName: 'Rodríguez',
          email: 'maria.rodriguez@provider.com',
          password: '123456',
          birthDate: DateTime.fromFormat('1990-07-22', 'yyyy-MM-dd'),
          roleId: 2 // proveedor
        },
        {
          name: 'Carlos Alberto',
          lastName: 'González',
          email: 'carlos.gonzalez@provider.com',
          password: '123456',
          birthDate: DateTime.fromFormat('1982-11-08', 'yyyy-MM-dd'),
          roleId: 2 // proveedor
        },
        {
          name: 'Ana Lucía',
          lastName: 'Morales',
          email: 'ana.morales@provider.com',
          password: '123456',
          birthDate: DateTime.fromFormat('1988-05-12', 'yyyy-MM-dd'),
          roleId: 2 // proveedor
        },
        {
          name: 'Roberto',
          lastName: 'Jiménez',
          email: 'roberto.jimenez@provider.com',
          password: '123456',
          birthDate: DateTime.fromFormat('1975-09-30', 'yyyy-MM-dd'),
          roleId: 2 // proveedor
        }
      ]

      for (const providerData of testProviders) {
        // Verificar si ya existe
        const existing = await User.findBy('email', providerData.email)
        if (!existing) {
          const provider = await User.create(providerData)
          console.log(`✅ Proveedor creado: ${provider.name} ${provider.lastName}`)
        } else {
          console.log(`⚠️ Proveedor ya existe: ${providerData.email}`)
        }
      }

      console.log('🎉 Proveedores de prueba creados exitosamente!')
      
    } catch (error) {
      console.error('❌ Error al crear proveedores de prueba:', error)
    }
  }
}
