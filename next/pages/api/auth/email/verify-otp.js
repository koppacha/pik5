import { getServerSession } from 'next-auth/next'
import crypto from 'crypto'
import prisma from '../../../../lib/prisma'
import { authOptions } from '../[...nextauth]'
import { normalizeEmail, hashEmail, encryptEmail } from '../../../../lib/emailCrypto'

function hashOtp(emailHash, otp) {
    return crypto.createHash('sha256').update(`${emailHash}:${otp}`).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) return res.status(401).json({ ok: false, message: 'Unauthorized' })

    const dbId = session.user.dbId
    const loginUserId = session.user.userId ?? session.user.id

    const user = dbId
        ? await prisma.user.findUnique({ where: { id: dbId }, select: { id: true } })
        : await prisma.user.findFirst({ where: { userId: loginUserId }, select: { id: true } })

    if (!user) return res.status(404).json({ ok: false, message: 'User not found' })

    const email = normalizeEmail(req.body?.email)
    const otp = String(req.body?.otp || '').trim()

    if (!email) return res.status(400).json({ ok: false, message: 'email is required' })
    if (!/^[0-9]{6}$/.test(otp)) return res.status(400).json({ ok: false, message: 'otp is invalid' })

    const emailHash = hashEmail(email)
    const otpHash = hashOtp(emailHash, otp)

    const rec = await prisma.emailOtp.findFirst({
        where: { userId: user.id, emailHash, otpHash },
        select: { id: true, expiresAt: true }
    })

    if (!rec) return res.status(403).json({ ok: false, message: 'OTP is incorrect' })
    if (new Date(rec.expiresAt).getTime() < Date.now()) {
        return res.status(403).json({ ok: false, message: 'OTP is expired' })
    }

    // 既に別ユーザーが同emailHashを登録していないか（ユニーク制約で弾かれるが事前にチェック）
    const exists = await prisma.user.findFirst({
        where: { emailHash, NOT: { id: user.id } },
        select: { id: true }
    })
    if (exists) return res.status(409).json({ ok: false, message: 'Email already in use' })

    await prisma.user.update({
        where: { id: user.id },
        data: {
            email: encryptEmail(email),
            emailHash,
            emailVerified: new Date(),
        }
    })

    await prisma.emailOtp.deleteMany({ where: { userId: user.id, emailHash } })

    return res.status(200).json({ ok: true })
}