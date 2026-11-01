const {test} = require('node:test')
const assert = require('node:assert/strict')
const {createHash, createHmac, randomBytes} = require('node:crypto')

// Opt in only for an empty, disposable API backed by a dedicated test MySQL.
const base = process.env.MEDIAN_MYSQL_TEST_BASE_URL
const secret = process.env.MEDIAN_MYSQL_TEST_SECRET
const enabled = Boolean(base && secret && process.env.MEDIAN_MYSQL_TEST_ISOLATED === '1')
if (enabled) {
    const url = new URL(base)
    assert.equal(url.protocol, 'http:')
    assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname))
    assert.equal(url.username + url.password, '')
}

test('dedicated MySQL serializes close, answer, reentry and queue receipt', {skip: !enabled}, async () => {
    let gameId
    const host = {kind: 'guest', name: 'Synthetic MySQL Host'}
    const guest = {kind: 'guest', name: 'Synthetic MySQL Guest'}
    async function request(who, action, data = {}) {
        const method = action ? 'POST' : 'GET'
        const body = action ? JSON.stringify({action, gameId, ...data}) : ''
        const principal = Buffer.from(JSON.stringify(who)).toString('base64')
        const timestamp = String(Math.floor(Date.now() / 1000))
        const nonce = randomBytes(16).toString('hex')
        const url = new URL('/api/median', base)
        const signature = createHmac('sha256', secret).update([timestamp, nonce, principal, method, url.pathname, createHash('sha256').update(body).digest('hex')].join('\n')).digest('hex')
        const res = await fetch(url, {method, headers: {'content-type': 'application/json', accept: 'application/json',
            'x-median-principal': principal, 'x-median-time': timestamp, 'x-median-nonce': nonce, 'x-median-signature': signature},
            ...(body && {body}), signal: AbortSignal.timeout(15000)})
        return {status: res.status, data: await res.json()}
    }
    async function ok(who, action, data) {
        const response = await request(who, action, data)
        assert.equal(response.status, 200, action)
        return response.data.game
    }
    assert.equal(await ok(host), null, 'requires an empty dedicated game database')
    gameId = (await ok(host, 'join', {host: true})).id
    await Promise.all(Array.from({length: 12}, () => ok(guest, 'join', {host: false})))
    assert.equal((await ok(host)).players.length, 2)
    assert.equal((await ok(host)).players[0].name, host.name)
    await ok(host, 'queue', {text: 'Concurrent question\nNext question', queueVersion: 0})
    await ok(host, 'show')
    await ok(host, 'answer', {roundId: 1, answer: {raw: '1', value: '1e+0', display: '1', valid: true}})
    await ok(guest, 'answer', {roundId: 1, answer: {raw: '2', value: '2e+0', display: '2', valid: true}})
    const results = await Promise.all([request(host, 'close'), request(host, 'close'),
        request(guest, 'answer', {roundId: 1, answer: {raw: '3', value: '3e+0', display: '3', valid: true}})])
    assert.deepEqual(results.slice(0, 2).map(r => r.status).sort(), [200, 409])
    assert.ok([200, 409].includes(results[2].status))
    const closing = await ok(guest)
    assert.equal(closing.phase, 'closing')
    await ok(guest, 'answer', {roundId: 1, closeToken: closing.round.closeToken, answer: {raw: '4', value: '4e+0', display: '4', valid: true}})
    const closed = await ok(host)
    assert.equal(closed.phase, 'closed')
    assert.equal(closed.round.answers, undefined)
    const revealed = await ok(host, 'reveal')
    assert.deepEqual(revealed.players.map(p => p.score), [-1, 2])
    await ok(guest, 'suggest', {text: 'Exactly once'})
    await Promise.all([ok(host, 'receive'), ok(host, 'receive')])
    assert.equal((await ok(host)).queue.length, 2)
    await ok(host, 'end')
    assert.equal((await ok(host)).ended, true)
})
