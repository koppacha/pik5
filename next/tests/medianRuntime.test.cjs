const {test} = require('node:test')
const assert = require('node:assert/strict')

const base = process.env.MEDIAN_RUNTIME_TEST_BASE_URL
const enabled = Boolean(base && process.env.MEDIAN_RUNTIME_TEST_ISOLATED === '1')
if (enabled) {
    const url = new URL(base)
    assert.equal(url.protocol, 'http:')
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
    assert.equal(url.username + url.password, '')
}

test('production Next API evaluates in a worker and preserves privacy through scoring', {skip: !enabled}, async () => {
    function client() {
        let cookie = ''
        return async (action, data = {}) => {
            const response = await fetch(new URL('/api/median', base), {method: action ? 'POST' : 'GET',
                headers: {'content-type': 'application/json', origin: base, ...(cookie && {cookie})},
                ...(action && {body: JSON.stringify({action, ...data})}), signal: AbortSignal.timeout(15000)})
            const setCookie = response.headers.getSetCookie().find(value => value.startsWith('pik5_median_guest='))
            if (setCookie) cookie = setCookie.split(';')[0]
            const body = await response.json()
            assert.equal(response.status, 200, `${action || 'state'}: ${body.message || ''}`)
            return body.game
        }
    }
    const host = client(), guest = client(), visitor = client()
    const previous = await visitor()
    assert.ok(!previous || previous.ended, 'requires an empty or ended disposable game')
    const h = await host('join', {host: true, name: 'API Synthetic Host'})
    const g = await guest('join', {host: false, name: 'API Synthetic Guest'})
    assert.equal((await host()).players[0].id, h.me)
    const common = {gameId: h.id}
    await host('queue', {...common, text: 'Runtime question', queueVersion: h.queueVersion})
    await host('show', common)
    const huge = await host('answer', {...common, roundId: 1, raw: '2^1000'})
    assert.equal(huge.round.own.valid, true)
    assert.equal(huge.round.own.value, '1.07150860718626732094842504906e+301')
    const decimal = await guest('answer', {...common, roundId: 1, raw: '0.1+0.2', answer: {value: '9e+999'}})
    assert.equal(decimal.round.own.value, '3e-1')
    assert.equal((await host()).round.answers, undefined)
    assert.equal((await guest()).queue, undefined)
    await host('close', common)
    assert.equal((await visitor()).round.answers, undefined)
    const closing = await guest()
    assert.equal(closing.phase, 'closing')
    await guest('answer', {...common, roundId: 1, closeToken: closing.round.closeToken, raw: '0.1+0.2'})
    const result = await host('reveal', common)
    assert.equal(result.players.find(p => p.id === h.me).score, 2)
    assert.equal(result.players.find(p => p.id === g.me).score, -1)
    await host('end', common)
    assert.equal((await guest()).ended, true)
})
