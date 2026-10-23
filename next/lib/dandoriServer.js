import {createHash, createHmac, randomBytes} from 'crypto'
import prisma from './prisma'

export const dandoriBase = process.env.TRICKS_LARAVEL_API_BASE || 'http://laravel:8000/api'

export async function currentManagementUser(session) {
    if (!session?.user) return null
    const where = session.user.dbId
        ? {id: session.user.dbId}
        : {userId: session.user.userId || session.user.id}
    return prisma.user.findUnique({where, select: {id: true, userId: true, role: true}})
}

export async function managementRequest(user, method = 'GET', data, path = 'dandori/manage') {
    const secret = process.env.TRICKS_INTERNAL_SECRET
    if (!secret) return {ok: false, status: 503, data: {message: '内部API認証の設定が必要です'}}
    const body = data ? JSON.stringify(data) : ''
    const url = new URL(`${dandoriBase}/${path}`)
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = randomBytes(16).toString('hex')
    const role = String(Number(user.role) || 0)
    const message = [timestamp, nonce, user.id, role, method, url.pathname, createHash('sha256').update(body).digest('hex')].join('\n')
    const response = await fetch(url, {method, ...(body && {body}), headers: {
        'content-type': 'application/json', accept: 'application/json',
        'x-management-user': user.id, 'x-management-role': role,
        'x-management-time': timestamp, 'x-management-nonce': nonce,
        'x-management-signature': createHmac('sha256', secret).update(message).digest('hex'),
    }})
    return {ok: response.ok, status: response.status, data: await response.json().catch(() => ({message: '管理APIの応答を取得できません'}))}
}
