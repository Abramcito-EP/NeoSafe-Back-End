#!/usr/bin/env node

/**
 * Script para crear cuenta de administrador
 * Uso: node create-admin.js
 */

import { Application } from '@adonisjs/core/app'
import AdminSeeder from './app/services/admin_seeder.js'

async function createAdmin() {
  console.log('🚀 Iniciando creación de administrador...')
  
  // Inicializar la aplicación AdonisJS
  const app = new Application(new URL('./', import.meta.url))
  await app.init()
  await app.start()

  try {
    // Crear cuenta de administrador
    await AdminSeeder.createAdminUser()
    
    console.log('')
    console.log('🎉 ¡Administrador creado exitosamente!')
    console.log('')
    console.log('📋 Credenciales de acceso:')
    console.log('┌─────────────────────────────────────────┐')
    console.log('│            CUENTA ADMINISTRADOR         │')
    console.log('├─────────────────────────────────────────┤')
    console.log('│ 📧 Email:    admin@neosafe.com          │')
    console.log('│ 🔐 Password: admin123                   │')
    console.log('│ 👤 Nombre:   Administrador Sistema      │')
    console.log('└─────────────────────────────────────────┘')
    console.log('')
    console.log('✅ Ya puedes iniciar sesión en la aplicación.')
    
  } catch (error) {
    console.error('❌ Error al crear administrador:', error.message)
    process.exit(1)
  } finally {
    await app.terminate()
    process.exit(0)
  }
}

// Ejecutar solo si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  createAdmin()
}

export { createAdmin }
