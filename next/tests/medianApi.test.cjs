const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')

function load({session = null, user = null, guest = null, evaluationError = null, upstream = {status: 200, data: {game: {}}}} = {}) {
    const calls = []
    const source = fs.readFileSync(require.resolve('../pages/api/median/index.js'), 'utf8')
        .replace(/^import .*$/gm, '').replace(/^export const config.*$/gm, '')
        .replace('export default async function handler', 'async function handler')
    const sandbox = {URL, getServerSession: async () => session, authOptions: {}, prisma: {user: {findUnique: async () => user}},
        guestIdentity: () => guest, medianSecret: () => 'synthetic-test-only', setGuestCookie: () => calls.push('cookie'),
        evaluateAnswer: async raw => {calls.push(['evaluate', raw]); if (evaluationError) throw new Error(evaluationError); return {raw, valid: true, value: '1e+0', display: '1'}},
        medianRequest: async (...args) => {calls.push(args); return upstream}, module: {exports: {}}}
    vm.runInNewContext(`${source}\nmodule.exports=handler`, sandbox)
    return {handler: sandbox.module.exports, calls}
}

async function run(fixture, body = {}, headers = {origin: 'https://example.invalid', host: 'example.invalid'}, method = 'POST') {
    const result = {headers: {}, statusCode: 0, data: null}
    const res = {setHeader: (k,v) => {result.headers[k] = v}, status: n => {result.statusCode = n; return res}, json: data => {result.data = data; return res}}
    await fixture.handler({method, headers, body, cookies: {}}, res)
    return result
}

test('signed-in identity comes from current account and allows equal display names', async () => {
    for (const userId of ['account-a', 'account-b']) {
        const f = load({session: {user: {dbId: 'synthetic-id'}}, user: {userId, name: 'Same Name'}})
        const result = await run(f, {action: 'join', host: false, name: 'Forged Name', userId: 'forged'})
        assert.equal(result.statusCode, 200)
        assert.equal(f.calls[0][0].userId, userId)
        assert.equal(f.calls[0][0].name, 'Same Name')
        assert.equal(f.calls[0][0].kind, 'user')
    }
})

test('an unavailable calculation runtime has a specific error without exposing internal details', async () => {
    const fixture = load({guest: {kind: 'guest', name: 'Synthetic'}, evaluationError: 'EVALUATOR_UNAVAILABLE'})
    const result = await run(fixture, {action: 'answer', raw: '123'})
    assert.equal(result.statusCode, 503)
    assert.equal(result.data.message, '計算機能を利用できません。管理者にお問い合わせください')
    assert.equal(fixture.calls.length, 1)
})

test('guest join retains exact name and server evaluation replaces forged answer', async () => {
    const f = load()
    assert.equal((await run(f, {action: 'join', name: ' Guest ', host: false})).statusCode, 200)
    assert.equal(f.calls[0][0].name, ' Guest ')
    assert.equal(f.calls[1], 'cookie')
    const g = load({guest: {kind: 'guest', name: 'Synthetic'}})
    await run(g, {action: 'answer', raw: '1', answer: {value: '9e+999'}})
    assert.equal(g.calls[1][2].answer.value, '1e+0')
})

test('origin, anonymous evaluation and upstream exception details are rejected', async () => {
    for (const origin of ['https://other.invalid', 'invalid', undefined]) {
        const f = load()
        assert.equal((await run(f, {action: 'join'}, {host: 'example.invalid', origin})).statusCode, 403)
        assert.equal(f.calls.length, 0)
    }
    const f = load()
    assert.equal((await run(f, {action: 'answer', raw: '2^10000'})).statusCode, 401)
    assert.equal(f.calls.length, 0)
    const g = load({upstream: {status: 500, data: {message: 'Synthetic internal exception', trace: ['internal'], sql: 'internal'}}})
    const result = await run(g, {}, {}, 'GET')
    assert.equal(result.statusCode, 500)
    assert.equal(Object.keys(result.data).join(','), 'message')
    assert.ok(!result.data.message.includes('exception'))
    assert.equal(result.headers['Cache-Control'], 'no-store, private')
})

test('calculation timeout does not save a zero answer upstream', async () => {
    const fixture = load({guest: {kind: 'guest', name: 'Synthetic'}, evaluationError: 'EVALUATOR_TIMEOUT'})
    const result = await run(fixture, {action: 'answer', raw: '123', roundId: 1})
    assert.equal(result.statusCode, 503)
    assert.equal(fixture.calls.filter(call => Array.isArray(call) && typeof call[0] === 'object').length, 0)
    assert.match(result.data.message, /上書きしていません/)
})
