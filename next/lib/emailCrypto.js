import crypto from 'crypto'

const encKey = Buffer.from(process.env.EMAIL_ENC_KEY_BASE64 || '', 'base64')
const hmacKey = Buffer.from(process.env.EMAIL_HMAC_KEY_BASE64 || '', 'base64')

export function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
}

export function hashEmail(email) {
    const norm = normalizeEmail(email)
    return crypto.createHmac('sha256', hmacKey).update(norm).digest('hex')
}

export function encryptEmail(email) {
    const norm = normalizeEmail(email)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv)
    const ct = Buffer.concat([cipher.update(norm, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    // v1:iv:tag:ciphertext (base64)
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptEmail(enc) {
    if (!enc || typeof enc !== 'string') return null
    const [v, ivB64, tagB64, ctB64] = enc.split(':')
    if (v !== 'v1') return null

    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')

    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}