const {test} = require('node:test')
const assert = require('node:assert/strict')
const {readFile} = require('node:fs/promises')
const {randomBytes} = require('node:crypto')
const {pathToFileURL} = require('node:url')
const path = require('node:path')

async function moduleFromSource(name) {
    const file = path.resolve(__dirname, '../lib', name)
    const source = await readFile(file, 'utf8')
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

test('untrusted forwarded headers cannot change the client address', async () => {
    const {resolveClientIp} = await moduleFromSource('requestContext.js')
    const request = {socket: {remoteAddress: '192.0.2.5'}, headers: {'x-forwarded-for': '203.0.113.100'}}
    assert.equal(resolveClientIp(request, ''), '192.0.2.5')
    assert.equal(resolveClientIp(request, '192.0.2.0/24'), '203.0.113.100')
    request.headers['x-forwarded-for'] = '203.0.113.100, 198.51.100.3'
    assert.equal(resolveClientIp(request, '192.0.2.0/24'), '198.51.100.3')
    request.headers['x-forwarded-for'] = 'invalid'
    assert.equal(resolveClientIp(request, '192.0.2.0/24'), null)
})

test('IPv6 and multiple trusted hops resolve to the first untrusted peer', async () => {
    const {resolveClientIp} = await moduleFromSource('requestContext.js')
    const request = {socket: {remoteAddress: '::1'}, headers: {'x-forwarded-for': '2001:db8::42, 192.0.2.1'}}
    assert.equal(resolveClientIp(request, '::1/128,192.0.2.0/24'), '2001:db8::42')
})

test('country signals require both explicit configuration and a trusted peer', async () => {
    const {resolveClientCountry} = await moduleFromSource('requestContext.js')
    const request = {socket: {remoteAddress: '192.0.2.5'}, headers: {'x-edge-country': 'US'}}
    assert.equal(resolveClientCountry(request, '', '192.0.2.0/24'), null)
    assert.equal(resolveClientCountry(request, 'x-edge-country', ''), null)
    assert.equal(resolveClientCountry(request, 'x-edge-country', '192.0.2.0/24'), 'US')
    request.headers['x-edge-country'] = 'US,JP'
    assert.equal(resolveClientCountry(request, 'x-edge-country', '192.0.2.0/24'), null)
})

test('email encryption rejects tampering, wrong keys, and missing HMAC configuration', async () => {
    process.env.EMAIL_ENC_KEY_BASE64 = randomBytes(32).toString('base64')
    process.env.EMAIL_HMAC_KEY_BASE64 = randomBytes(32).toString('base64')
    const {encryptEmail, decryptEmail, hashEmail} = await moduleFromSource('emailCrypto.js')
    const first = encryptEmail('Synthetic@example.invalid')
    const second = encryptEmail('Synthetic@example.invalid')
    assert.notEqual(first, second)
    assert.equal(decryptEmail(first), 'synthetic@example.invalid')
    const parts = first.split(':')
    const modified = Buffer.from(parts[2], 'base64')
    modified[0] ^= 1
    parts[2] = modified.toString('base64')
    assert.throws(() => decryptEmail(parts.join(':')))
    process.env.EMAIL_ENC_KEY_BASE64 = randomBytes(32).toString('base64')
    assert.throws(() => decryptEmail(first))
    delete process.env.EMAIL_HMAC_KEY_BASE64
    assert.throws(() => hashEmail('synthetic@example.invalid'))
    assert.equal(decryptEmail('v1:invalid'), null)
})

test('production date boundary and development override are independent of stage publication', async () => {
    const {showDandoriBox, DANDORI_START} = await moduleFromSource('dandori.js')
    assert.equal(showDandoriBox(DANDORI_START - 1, false), false)
    assert.equal(showDandoriBox(DANDORI_START, false), true)
    assert.equal(showDandoriBox(DANDORI_START - 86400000, true), true)
})

test('monthly titles use the selected release month and difficulty labels include unknown values', async () => {
    const {dandoriMonthLabel, dandoriDifficultyLabel} = await moduleFromSource('dandori.js')
    assert.equal(dandoriMonthLabel('2026-10', Date.parse('2026-11-01T00:00:00+09:00')), '2026年10月')
    assert.equal(dandoriMonthLabel('2027-11', Date.now()), '2027年11月')
    assert.equal(dandoriMonthLabel(null, Date.parse('2026-09-30T15:00:00Z')), '2026年10月')
    assert.deepEqual([1, 2, 3, 0, 4, 9, null, undefined].map(dandoriDifficultyLabel), ['おてがる', 'ほんかく', 'きわみ', '不明', '不明', '不明', '不明', '不明'])
})

test('world record numeric times preserve ordinary score storage and rule 48 remaining time', async () => {
    const {worldRecordScore} = await moduleFromSource('worldRecordScore.js')
    assert.equal(worldRecordScore('30', 33, {time: 300, score: 1000}), 1270)
    assert.equal(worldRecordScore('90', 36, {time: 300, score: 1000}), 1210)
    assert.equal(worldRecordScore('150', 48, {time: 300, score: 1000}), 150)
    assert.equal(worldRecordScore('1234', 31), 1234)
})


test('world record platforms respect mixed rule 34 and fixed Switch rule 48', async () => {
    const {worldRecordPlatforms} = await moduleFromSource('worldRecordScore.js')
    for (const stage of [301, 330, 345, 350]) assert.deepEqual(worldRecordPlatforms(stage, 34), [3, 4])
    for (const stage of [331, 344]) assert.deepEqual(worldRecordPlatforms(stage, 34), [4])
    for (const stage of [301, 445, '4A0']) assert.deepEqual(worldRecordPlatforms(stage, 48), [4])
    assert.deepEqual(worldRecordPlatforms(419, 41), [])
})

test('world record time input converts hours/minutes/seconds and rejects invalid times', async () => {
    const {parseWorldRecordTime, worldRecordScore} = await moduleFromSource('worldRecordScore.js')
    assert.equal(parseWorldRecordTime('00:02:30'), 150)
    assert.equal(parseWorldRecordTime('2:30'), 150)
    assert.equal(parseWorldRecordTime('01:02:03'), 3723)
    for (const text of ['abc', '-1:20', '00:60:00', '1:99', '1.5', '']) assert.ok(Number.isNaN(parseWorldRecordTime(text)))
    assert.equal(worldRecordScore(parseWorldRecordTime('00:00:30'), 34, {time: 420, score: 0}), 390)
})
