import {getServerSession} from 'next-auth/next'
import bcrypt from 'bcrypt'
import prisma from '../../../lib/prisma'
import {authOptions} from './[...nextauth]'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
    }

    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
        return res.status(401).json({ ok: false, message: 'Unauthorized' })
    }

    const body = req.body ?? {}
    const currentPassword = body.currentPassword
    const nextName = body.name
    const nextPassword = body.newPassword

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
        return res.status(400).json({ ok: false, message: 'currentPassword is required' })
    }

    const dbId = session.user.dbId
    const loginUserId = session.user.userId ?? session.user.id

    // セッション互換対応:
    // - 新方式: session.user.dbId が DB 主キー
    // - 旧方式/互換: session.user.id / userId がログインID(userId)
    let user = null

    if (dbId != null) {
        user = await prisma.user.findUnique({
            where: { id: dbId },
            select: { id: true, password: true, name: true, userId: true }
        })
    }

    if (!user && loginUserId) {
        user = await prisma.user.findFirst({
            where: { userId: loginUserId },
            select: { id: true, password: true, name: true, userId: true }
        })
    }

    if (!user) {
        return res.status(404).json({ ok: false, message: 'User not found' })
    }

    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) {
        return res.status(403).json({ ok: false, message: 'Current password is incorrect' })
    }

    const data = {}

    if (typeof nextName === 'string') {
        const trimmed = nextName.trim()
        if (trimmed && trimmed !== user.name) data.name = trimmed
    }

    if (typeof nextPassword === 'string' && nextPassword.length > 0) {
        // ここは要件に合わせて調整してください（長さ/複雑性など）
        if (nextPassword.length < 8) {
            return res.status(400).json({ ok: false, message: 'New password must be at least 8 characters' })
        }
        data.password = await bcrypt.hash(nextPassword, 10)
    }

    if (Object.keys(data).length === 0) {
        return res.status(400).json({ ok: false, message: 'No changes' })
    }

    await prisma.user.update({
        where: { id: user.id },
        data
    })

    return res.status(200).json({
        ok: true,
        changed: {
            name: Boolean(data.name),
            password: Boolean(data.password)
        },
        name: data.name ?? user.name
    })
}