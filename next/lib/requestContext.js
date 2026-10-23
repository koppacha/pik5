import {BlockList, isIP} from 'net'

function normalizeIp(value) {
    const ip = String(value || '').trim().replace(/^::ffff:/, '')
    return isIP(ip) ? ip : null
}

function trustedProxies(trustedCidrs) {
    const trusted = new BlockList()
    for (const item of trustedCidrs.split(',').map(value => value.trim()).filter(Boolean)) {
        const [address, prefix] = item.split('/')
        const family = isIP(address)
        if (!family) throw new Error('Invalid trusted proxy configuration')
        trusted.addSubnet(address, prefix === undefined ? (family === 4 ? 32 : 128) : Number(prefix), family === 4 ? 'ipv4' : 'ipv6')
    }
    return trusted
}

export function resolveClientIp(req, trustedCidrs = process.env.TRUSTED_PROXY_CIDRS || '') {
    const trusted = trustedProxies(trustedCidrs)
    const remote = normalizeIp(req.socket?.remoteAddress)
    if (!remote) return null
    const hops = String(req.headers?.['x-forwarded-for'] || '').split(',').map(normalizeIp)
    let current = remote
    while (trusted.check(current, isIP(current) === 4 ? 'ipv4' : 'ipv6') && hops.length) {
        const next = hops.pop()
        if (!next) return null
        current = next
    }
    return current
}

export function resolveClientCountry(req, header = process.env.TRUSTED_COUNTRY_HEADER || '', trustedCidrs = process.env.TRUSTED_PROXY_CIDRS || '') {
    if (!header) return null
    // Enabling this requires the trusted edge to overwrite this header and block direct access.
    const peer = normalizeIp(req.socket?.remoteAddress)
    if (!peer || !trustedProxies(trustedCidrs).check(peer, isIP(peer) === 4 ? 'ipv4' : 'ipv6')) return null
    const country = String(req.headers?.[header.toLowerCase()] || '').toUpperCase()
    return /^[A-Z]{2}$/.test(country) && country !== 'XX' ? country : null
}
