import crypto from 'crypto'
import prisma from '../../../../lib/prisma'

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const token = String(req.body?.token || '').trim()
    if (!token) return res.status(400).json({ ok: false })

    const tokenHash = hashToken(token)

    const rec = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { expiresAt: true, usedAt: true }
    })

    if (!rec) return res.status(200).json({ ok: false })
    if (rec.usedAt) return res.status(200).json({ ok: false })
    if (new Date(rec.expiresAt).getTime() < Date.now()) return res.status(200).json({ ok: false })

    return res.status(200).json({ ok: true })
}