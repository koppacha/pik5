import crypto from 'crypto'
import bcrypt from 'bcrypt'
import prisma from '../../../../lib/prisma'

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const token = String(req.body?.token || '').trim()
    const newPassword = String(req.body?.newPassword || '')
    if (!token) return res.status(400).json({ ok: false })
    if (newPassword.length < 8) return res.status(400).json({ ok: false, message: 'Password too short' })

    const tokenHash = hashToken(token)

    const rec = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true }
    })

    if (!rec) return res.status(403).json({ ok: false })
    if (rec.usedAt) return res.status(403).json({ ok: false })
    if (new Date(rec.expiresAt).getTime() < Date.now()) return res.status(403).json({ ok: false })

    const hashed = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
        prisma.user.update({
            where: { id: rec.userId },
            data: { password: hashed }
        }),
        prisma.passwordResetToken.update({
            where: { id: rec.id },
            data: { usedAt: new Date() }
        })
    ])

    return res.status(200).json({ ok: true })
}