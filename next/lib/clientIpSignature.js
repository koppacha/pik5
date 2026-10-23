import {createHmac} from 'crypto'
import {resolveClientIp, resolveClientCountry} from './requestContext'

export function clientIpHeaders(req, path) {
    const ip = resolveClientIp(req)
    const secret = process.env.TRICKS_INTERNAL_SECRET
    if (!ip || !secret) return {}
    const timestamp = String(Math.floor(Date.now() / 1000))
    const country = resolveClientCountry(req) || ''
    return {'x-client-ip': ip, 'x-client-time': timestamp, 'x-client-country': country,
        'x-client-signature': createHmac('sha256', secret).update([timestamp, req.method, path, ip, country].join('\n')).digest('hex')}
}
