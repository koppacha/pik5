import {clientIpHeaders} from '../../lib/clientIpSignature'
import {dandoriBase} from '../../lib/dandoriServer'

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end()
    res.setHeader('Cache-Control', 'no-store')
    try {
        const response = await fetch(`${dandoriBase}/dandori`, {headers: clientIpHeaders(req, new URL(`${dandoriBase}/dandori`).pathname)})
        return res.status(response.status).json(await response.json())
    } catch {
        return res.status(503).json({message: '検定情報を取得できません'})
    }
}
