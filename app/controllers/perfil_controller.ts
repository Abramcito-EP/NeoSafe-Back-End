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
                name: vine.string().minLength(2).optional(),
                lastName: vine.string().minLength(2).optional(),
                email: vine.string().email().optional(),
                birthDate: vine.date().optional(),
                password: vine.string().minLength(6).confirmed().optional(),
            })
        )

        try {
            await auth.authenticate()
            const data = await request.validateUsing(profileSchema)

            const user = await User.findOrFail(auth.user!.id)

            // Verificar si el email ya existe
            if (data.email && data.email !== user.email) {
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

            // Actualizar campos del perfil
            if (data.name) user.name = data.name
            if (data.lastName) user.lastName = data.lastName
            if (data.birthDate) user.birthDate = data.birthDate
            if (data.password) user.password = data.password

            await user.save()

            // Recargar el usuario con las relaciones
            const updatedUser = await User.query()
                .where('id', user.id)
                .preload('role')
                .firstOrFail()

            return response.ok({
                message: 'Perfil actualizado correctamente',
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    lastName: updatedUser.lastName,
                    email: updatedUser.email,
                    birthDate: updatedUser.birthDate,
                    role: updatedUser.role?.name,
                },
            })
        } catch (error) {
            return response.badRequest({
                message: 'Error al actualizar perfil',
                errors: error.messages || error.message,
            })
        }
    }
}
