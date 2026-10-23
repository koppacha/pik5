import crypto from 'crypto'

function getKey(name, exactLength = null) {
    const encoded = process.env[name] || ''
    const key = Buffer.from(encoded, 'base64')
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || key.toString('base64') !== encoded || (exactLength ? key.length !== exactLength : key.length < 32)) {
        throw new Error('Email cryptographic key configuration is invalid')
    }
    return key
}

export function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase()
}

export function hashEmail(email) {
    const norm = normalizeEmail(email)
    return crypto.createHmac('sha256', getKey('EMAIL_HMAC_KEY_BASE64')).update(norm).digest('hex')
}

export function encryptEmail(email) {
    const norm = normalizeEmail(email)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey('EMAIL_ENC_KEY_BASE64', 32), iv)
    const ct = Buffer.concat([cipher.update(norm, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    // v1:iv:tag:ciphertext (base64)
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function decryptEmail(enc) {
    if (!enc || typeof enc !== 'string') return null
    const parts = enc.split(':')
    const [v, ivB64, tagB64, ctB64] = parts
    if (parts.length !== 4 || v !== 'v1' || ![ivB64, tagB64, ctB64].every(value => /^[A-Za-z0-9+/]+={0,2}$/.test(value))) return null

    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')

    if (iv.length !== 12 || tag.length !== 16) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey('EMAIL_ENC_KEY_BASE64', 32), iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}