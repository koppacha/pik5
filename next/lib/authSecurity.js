import {AsyncLocalStorage} from 'async_hooks'
import {createHmac} from 'crypto'
import {managementRequest} from './dandoriServer'
import {resolveClientIp, resolveClientCountry} from './requestContext'

export const authRequestContext = new AsyncLocalStorage()
const service = {id: 'auth-service', role: 0}

export async function checkAuthLimit(req, res, scope, account = '') {
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
        res.status(503).json({message: '認証サービスを利用できません'})
        return false
    }
    const ip = resolveClientIp(req) || 'unknown'
    const country = resolveClientCountry(req)
    const foreign = country && country !== 'JP'
    const errorUrl = scope === 'login' ? '/auth/login?error=AccessDenied' : undefined
    const identity = String(account).trim().toLowerCase().slice(0, 254)
    try {
        for (const [kind, value, maximum] of [['ip', ip, foreign ? 20 : 60], ...(identity ? [['account', identity, scope === 'otp-verify' ? 5 : 10]] : [])]) {
            const key = createHmac('sha256', secret).update(`${scope}\n${kind}\n${value}`).digest('hex')
            const result = await managementRequest(service, 'POST', {action: 'limit', keys: [key], maximum, seconds: 900}, 'security/events')
            if (!result.ok) {
                const retry = result.data.retry_after || 900
                res.setHeader('Retry-After', String(retry))
                res.status(result.status === 429 ? 429 : 503).json({...(errorUrl && {url: errorUrl}), message: result.status === 429 ? '操作回数が多いため、時間をおいてお試しください' : '認証サービスを利用できません'})
                return false
            }
        }
        return true
    } catch {
        res.status(503).json({...(errorUrl && {url: errorUrl}), message: '認証サービスを利用できません'})
        return false
    }
}

export async function recordLoginEvent(outcome, userId = null) {
    const context = authRequestContext.getStore()
    if (!context) return
    try {
        const result = await managementRequest(service, 'POST', {action: 'event', outcome,
            user_id: userId, ip: context.ip, user_agent: context.userAgent}, 'security/events')
        if (!result.ok) console.warn('login audit unavailable')
    } catch {
        console.warn('login audit unavailable')
    }
}
