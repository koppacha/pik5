import { getServerSession } from 'next-auth/next'
import crypto from 'crypto'
import prisma from '../../../../lib/prisma'
import { authOptions } from '../[...nextauth]'
import { normalizeEmail, hashEmail, encryptEmail } from '../../../../lib/emailCrypto'
import { sendMail } from '../../../../lib/mailer'

function genOtp6() {
    const n = crypto.randomInt(0, 1000000)
    return String(n).padStart(6, '0')
}

function hashOtp(emailHash, otp) {
    // OTPは短いので emailHash を混ぜてsha256
    return crypto.createHash('sha256').update(`${emailHash}:${otp}`).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) return res.status(401).json({ ok: false, message: 'Unauthorized' })

    // ユーザー特定: dbId優先、無ければuserId
    const dbId = session.user.dbId
    const loginUserId = session.user.userId ?? session.user.id

    const user = dbId
        ? await prisma.user.findUnique({ where: { id: dbId }, select: { id: true, name: true } })
        : await prisma.user.findFirst({ where: { userId: loginUserId }, select: { id: true, name: true } })

    if (!user) return res.status(404).json({ ok: false, message: 'User not found' })

    const email = normalizeEmail(req.body?.email)
    if (!email) return res.status(400).json({ ok: false, message: 'email is required' })

    const emailHash = hashEmail(email)

    // 再送や連打抑止（超簡易: 直近30秒以内に作ったOTPがあれば拒否）
    const recent = await prisma.emailOtp.findFirst({
        where: { userId: user.id, emailHash },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, expiresAt: true },
    })
    if (recent && (Date.now() - new Date(recent.createdAt).getTime()) < 30_000) {
        return res.status(429).json({ ok: false, message: 'Too many requests' })
    }

    const otp = genOtp6()
    const otpHash = hashOtp(emailHash, otp)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

    // 既存OTPは削除して作り直し（同ユーザー/同emailHash）
    await prisma.emailOtp.deleteMany({ where: { userId: user.id, emailHash } })
    await prisma.emailOtp.create({
        data: { userId: user.id, emailHash, otpHash, expiresAt }
    })

    await sendMail({
        to: email,
        subject: 'メールアドレス認証コード（10分有効）',
        text: `認証コード: ${otp}\n\nこのコードは10分で失効します。\n心当たりがない場合はこのメールを破棄してください。`,
    })

    return res.status(200).json({ ok: true })
}