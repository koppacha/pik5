import {createHash, createHmac, randomBytes, timingSafeEqual} from 'crypto'
import {Worker} from 'worker_threads'
import {createEvaluator} from './evaluator.cjs'

export const medianSecret = () => process.env.MEDIAN_INTERNAL_SECRET || process.env.TRICKS_INTERNAL_SECRET || ''
const cookieName = 'pik5_median_guest'

export function guestIdentity(req) {
    const token = req.cookies?.[cookieName] || ''
    const [payload, signature] = token.split('.')
    if (!payload || !signature || !medianSecret()) return null
    const expected = createHmac('sha256', medianSecret()).update(`median-guest:${payload}`).digest('hex')
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    try {
        const name = JSON.parse(Buffer.from(payload, 'base64url').toString()).name
        return typeof name === 'string' && name.trim() && name.length <= 80 ? {kind: 'guest', name} : null
    } catch { return null }
}

export function setGuestCookie(res, name) {
    const payload = Buffer.from(JSON.stringify({name})).toString('base64url')
    const signature = createHmac('sha256', medianSecret()).update(`median-guest:${payload}`).digest('hex')
    res.setHeader('Set-Cookie', `${cookieName}=${payload}.${signature}; Path=/api/median; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
}

export async function medianRequest(identity, method, payload) {
    const secret = medianSecret()
    if (!secret) return {status: 503, data: {message: 'ゲーム用APIの認証設定がありません'}}
    const body = method === 'POST' ? JSON.stringify(payload) : ''
    const principal = Buffer.from(JSON.stringify(identity || {kind: 'visitor'})).toString('base64')
    const timestamp = String(Math.floor(Date.now() / 1000))
    const nonce = randomBytes(16).toString('hex')
    const path = '/api/median'
    const signature = createHmac('sha256', secret).update([timestamp, nonce, principal, method, path, createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex')
    const base = process.env.MEDIAN_LARAVEL_API_BASE || 'http://laravel:8000/api'
    const response = await fetch(`${base}/median`, {
        method, headers: {'content-type': 'application/json', accept: 'application/json',
            'x-median-principal': principal, 'x-median-time': timestamp, 'x-median-nonce': nonce, 'x-median-signature': signature},
        ...(body && {body}), signal: AbortSignal.timeout(10000), cache: 'no-store',
    })
    return {status: response.status, data: await response.json().catch(() => ({message: 'ゲーム状態を取得できません'}))}
}

let running = 0
export async function evaluateAnswer(input) {
    if (running >= 8) throw new Error('EVALUATOR_BUSY')
    running += 1
    try {
        return await new Promise((resolve, reject) => {
            // Resolve mathjs inside Node's worker, outside webpack's module resolver.
            const worker = new Worker(`const {parentPort,workerData}=require('worker_threads'); const createEvaluator=(${createEvaluator.toString()}); parentPort.postMessage(createEvaluator(require('mathjs'))(workerData.input))`, {
                eval: true, workerData: {input}, resourceLimits: {maxOldGenerationSizeMb: 128},
            })
            const timer = setTimeout(() => {
                worker.terminate()
                resolve({raw: input, value: '0e+0', display: '0', valid: false, error: '計算時間の上限を超えました'})
            }, 2000)
            worker.once('message', value => {clearTimeout(timer); worker.terminate(); resolve(value)})
            worker.once('error', error => {
                clearTimeout(timer)
                reject(new Error(error.code === 'MODULE_NOT_FOUND' ? 'EVALUATOR_UNAVAILABLE' : 'EVALUATOR_FAILED'))
            })
            worker.once('exit', code => {if (code !== 0) {clearTimeout(timer); reject(new Error('EVALUATOR_FAILED'))}})
        })
    } finally { running -= 1 }
}
