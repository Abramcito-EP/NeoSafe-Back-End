import 'reflect-metadata'
import { Ignitor } from '@adonisjs/core'

new Ignitor(new URL('./', import.meta.url))
  .tap((app) => {
    app.booting(async () => {
      await import('#start/kernel')
    })
    
    app.listen('SIGTERM', () => app.terminate())
    app.listen('SIGINT', () => app.terminate())
    
    app.ready(async () => {
      await import('#start/routes')
    })
  })
  .httpServer()
  .start()
  .catch(console.error)