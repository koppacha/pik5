import crypto from 'crypto'
import prisma from '../../../../lib/prisma'
import { normalizeEmail, hashEmail, decryptEmail } from '../../../../lib/emailCrypto'
import { sendMail } from '../../../../lib/mailer'

function genToken() {
    return crypto.randomBytes(32).toString('hex')
}
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ ok: false })

    const email = normalizeEmail(req.body?.email)
    if (!email) return res.status(200).json({ ok: true }) // 推測防止

    const emailHash = hashEmail(email)

    const user = await prisma.user.findFirst({
        where: { emailHash, emailVerified: { not: null } },
        select: { id: true, email: true }
    })

    // 推測防止: ユーザーがいなくても成功応答
    if (!user) return res.status(200).json({ ok: true })

    const token = genToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 60分（適宜変更）

    await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
    })

    const to = decryptEmail(user.email)
    const base = process.env.APP_BASE_URL
    const url = `${base}/auth/reset/${token}`

    await sendMail({
        to,
        subject: 'パスワードリセット / Password Reset',
        text: `パスワードリセット用URL（有効期限あり）:\n${url}\n\n心当たりがない場合はこのメールを破棄してください。\n\nTo request a password reset, please click the URL. If you did not request this email, please ignore it.`,
    })

    return res.status(200).json({ ok: true })
}