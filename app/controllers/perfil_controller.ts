import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

export default class PerfilController {
    async show({ auth, response }: HttpContext) {
        try {
            await auth.authenticate()

            const user = await User.query()
                .where('id', auth.user!.id)
                .preload('role')
                .firstOrFail()

            return response.ok({
                id: user.id,
                name: user.name,
                lastName: user.lastName,
                email: user.email,
                birthDate: user.birthDate,
                role: user.role?.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })
        } catch (error) {
            return response.unauthorized({ message: 'No autenticado' })
        }
    }

    async update({ request, auth, response }: HttpContext) {
        const profileSchema = vine.compile(
            vine.object({
                email: vine.string().email().optional(),
                password: vine.string().minLength(6).confirmed().optional(),
            })
        )

        try {
            await auth.authenticate()
            const data = await request.validateUsing(profileSchema)

            const user = await User.findOrFail(auth.user!.id)

            if (data.email) {
                const existing = await User.query()
                    .where('email', data.email)
                    .whereNot('id', user.id)
                    .first()

                if (existing) {
                    return response.badRequest({
                        message: 'Ya existe un usuario con ese correo electrónico',
                    })
                }

                user.email = data.email
            }

            if (data.password) {
                user.password = data.password
            }
            await user.save()

            return response.ok({ message: 'Perfil actualizado correctamente' })
        } catch (error) {
            return response.badRequest({
                message: 'Error al actualizar perfil',
                errors: error.messages || error.message,
            })
        }
    }
}
