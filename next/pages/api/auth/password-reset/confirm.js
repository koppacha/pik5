import {checkAuthLimit} from '../../../../lib/authSecurity'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import prisma from '../../../../lib/prisma'
import {isValidPassword} from '../../../../lib/passwordPolicy'

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })
    if (!await checkAuthLimit(req, res, 'reset-confirm', req.body?.token)) return

    const token = String(req.body?.token || '').trim()
    const newPassword = String(req.body?.newPassword || '')
    if (!token) return res.status(400).json({ ok: false })
    if (!isValidPassword(newPassword)) {
        return res.status(400).json({ ok: false, message: 'Password must be 8-72 safe printable ASCII characters' })
    }

    const tokenHash = hashToken(token)

    const rec = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true }
    })

    if (!rec) return res.status(403).json({ ok: false })
    if (rec.usedAt) return res.status(403).json({ ok: false })
    if (new Date(rec.expiresAt).getTime() < Date.now()) return res.status(403).json({ ok: false })

    const hashed = await bcrypt.hash(newPassword, 10)

    const consumed = await prisma.$transaction(async transaction => {
        const result = await transaction.passwordResetToken.updateMany({
            where: {id: rec.id, usedAt: null, expiresAt: {gt: new Date()}},
            data: {usedAt: new Date()},
        })
        if (result.count !== 1) return false
        await transaction.user.update({where: {id: rec.userId}, data: {password: hashed}})
        return true
    })
    if (!consumed) return res.status(403).json({ok: false})

    return res.status(200).json({ ok: true })
}
