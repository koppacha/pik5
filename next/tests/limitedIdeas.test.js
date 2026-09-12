import assert from 'node:assert/strict'
import {test} from 'node:test'
import {canAccessLimitedIdeas, LIMITED_IDEAS_START, LIMITED_IDEAS_END, limitedIdeasRatio, validateLimitedIdea} from '../lib/limitedIdeas'
import {createLimitedIdeasHandler, isLimitedIdeasSameOrigin} from '../lib/limitedIdeasApi'

const valid = {title: 2, stageId: 201, ruleName: 'テストルール', difficulty: 3, registrationMethod: 'score', body: 'テスト本文'}
const publicTime = Date.parse(LIMITED_IDEAS_START)

test('JST publication boundaries and administrator exception', () => {
    assert.equal(canAccessLimitedIdeas(null, publicTime - 1), false)
    assert.equal(canAccessLimitedIdeas(null, publicTime), true)
    assert.equal(canAccessLimitedIdeas({role: '1'}, Date.parse(LIMITED_IDEAS_END) - 1), true)
    assert.equal(canAccessLimitedIdeas(null, Date.parse(LIMITED_IDEAS_END)), false)
    for (const role of ['10', 10]) {
        assert.equal(canAccessLimitedIdeas({role}, publicTime - 1), true)
        assert.equal(canAccessLimitedIdeas({role}, Date.parse(LIMITED_IDEAS_END)), true)
    }
    assert.equal(canAccessLimitedIdeas({role: '100'}, publicTime - 1), false)
})

test('ratio counts rules, minimum 1.00', () => {
    assert.equal(limitedIdeasRatio(0), '1.00')
    assert.equal(limitedIdeasRatio(200), '1.00')
    assert.equal(limitedIdeasRatio(201), '1.01')
    assert.equal(limitedIdeasRatio(300), '1.50')
})

test('validation rejects forged fields, invalid ranges and excessive Unicode lengths', () => {
    assert.equal(validateLimitedIdea(valid), null)
    assert.equal(validateLimitedIdea({...valid, title: 4, stageId: 428, registrationMethod: 'time', ruleName: '😀'.repeat(10), body: 'あ'.repeat(256)}), null)
    for (const patch of [
        {title: 3}, {title: '2'}, {stageId: 401}, {stageId: 200}, {stageId: 231},
        {title: 4, stageId: 429}, {stageId: 201.1}, {ruleName: ''}, {ruleName: ' '.repeat(2)},
        {ruleName: 'あ'.repeat(11)}, {ruleName: '😀'.repeat(11)}, {difficulty: 0}, {difficulty: 6},
        {difficulty: 1.5}, {difficulty: '1'}, {registrationMethod: 'sql'}, {body: ''}, {body: 'あ'.repeat(257)},
    ]) assert.ok(validateLimitedIdea({...valid, ...patch}), JSON.stringify(patch))
    for (const value of [null, [], 'invalid']) assert.ok(validateLimitedIdea(value))
})

test('CSRF rejects cross-origin, missing/null Origin and cross-site metadata', () => {
    const req = {headers: {host: 'localhost:3005', origin: 'http://localhost:3005'}}
    assert.equal(isLimitedIdeasSameOrigin(req), true)
    assert.equal(isLimitedIdeasSameOrigin({headers: {...req.headers, origin: 'https://attacker.invalid'}}), false)
    assert.equal(isLimitedIdeasSameOrigin({headers: {...req.headers, origin: undefined}}), false)
    assert.equal(isLimitedIdeasSameOrigin({headers: {...req.headers, origin: 'null'}}), false)
    assert.equal(isLimitedIdeasSameOrigin({headers: {...req.headers, 'sec-fetch-site': 'cross-site'}}), false)
    assert.equal(isLimitedIdeasSameOrigin(req, 'https://production.invalid'), false)
})

test('real MySQL: history, ownership, CSRF, unique counts, soft delete and concurrent edits', {skip: !process.env.LIMITED_IDEAS_TEST_DATABASE_URL}, async () => {
    const url = new URL(process.env.LIMITED_IDEAS_TEST_DATABASE_URL)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.pathname, '/limited_ideas_test')
    const {PrismaMariaDb} = await import('@prisma/adapter-mariadb')
    const {PrismaClient} = await import('../generated/prisma/client')
    const db = new PrismaClient({adapter: new PrismaMariaDb(url.toString())})
    const users = {
        a: {id: 'a', name: 'テスト作成者A', role: '1'},
        b: {id: 'b', name: 'テスト管理者B', role: '10'},
        c: {id: 'c', name: 'テスト第三者C', role: '1'},
    }
    let session = null
    let clock = publicTime
    const api = createLimitedIdeasHandler({
        prisma: {user: {findUnique: async ({where}) => users[where.id] || null}, limitedIdea: db.limitedIdea, $transaction: db.$transaction.bind(db)},
        getSession: async () => session, now: () => clock, siteUrl: 'http://localhost:3005',
    })
    const call = async (method = 'GET', body = undefined, query = {}, headers = {}) => {
        const result = {headers: {}}
        const res = {setHeader: (key, value) => { result.headers[key] = value }, status: code => { result.status = code
            return res }, json: data => { result.data = data
            return res }}
        await api({method, body, query, headers: {host: 'localhost:3005', origin: 'http://localhost:3005', 'content-type': 'application/json', ...headers}}, res)
        return result
    }
    const login = (id) => { session = {user: {dbId: id, role: '10', userId: 'b'}} }
    try {
        await db.limitedIdea.deleteMany({})
        clock = publicTime - 1
        assert.equal((await call()).status, 403)
        login('a')
        assert.equal((await call('POST', valid)).status, 403)
        login('b')
        assert.equal((await call()).status, 200)
        clock = publicTime
        session = null
        assert.equal((await call()).data.count, 0)
        assert.equal((await call('GET', undefined, {view: 'mine'})).status, 401)
        assert.equal((await call('POST', valid)).status, 401)
        login('a')
        assert.equal((await call('PATCH', valid)).status, 405)
        assert.equal((await call('POST', valid, {}, {origin: 'https://attacker.invalid'})).status, 403)
        assert.equal((await call('POST', valid, {}, {'content-type': 'text/plain'})).status, 415)
        assert.equal((await call('POST', {...valid, stageId: 401})).status, 400)
        const created = await call('POST', {...valid, creatorId: 'b', editorId: 'b', hidden: true, revision: 99})
        assert.equal(created.status, 201)
        const original = created.data.item
        const row = await db.limitedIdea.findUnique({where: {currentKey: original.ruleId}})
        assert.equal(row.creatorId, 'a')
        assert.equal(row.editorId, 'a')
        assert.equal(row.revision, 1)
        assert.equal(row.hidden, false)
        assert.equal(row.createdAt.getTime(), clock)
        assert.equal(row.updatedAt.getTime(), clock)
        login('c')
        assert.equal((await call('GET', undefined, {view: 'mine'})).data.items.length, 0)
        assert.equal((await call('PUT', {...original, body: '不正編集'})).status, 404)
        assert.equal((await call('DELETE', original)).status, 404)
        login('b')
        clock += 1000
        const edited = await call('PUT', {...original, body: '<script>alert(1)</script>'})
        assert.equal(edited.status, 200)
        assert.equal(edited.data.item.creatorName, 'テスト作成者A')
        const latest = await db.limitedIdea.findUnique({where: {currentKey: original.ruleId}})
        assert.equal(latest.creatorId, 'a')
        assert.equal(latest.editorId, 'b')
        assert.equal(latest.createdAt.getTime(), row.createdAt.getTime())
        assert.equal(await db.limitedIdea.count(), 2)
        assert.equal((await call()).data.count, 1)
        assert.equal((await call('GET', undefined, {view: 'mine'})).data.ownCount, 0)
        assert.equal((await call('PUT', original)).status, 409)
        login('a')
        const concurrent = await Promise.all([
            call('PUT', {...edited.data.item, body: '同時編集1'}),
            call('PUT', {...edited.data.item, body: '同時編集2'}),
        ])
        assert.deepEqual(concurrent.map(value => value.status).sort(), [200, 409])
        const head = concurrent.find(value => value.status === 200).data.item
        assert.equal(await db.limitedIdea.count(), 3)
        assert.equal((await call('DELETE', head)).status, 200)
        assert.equal((await call()).data.count, 0)
        assert.equal((await call('GET', undefined, {view: 'mine'})).data.items.length, 0)
        assert.equal(await db.limitedIdea.count(), 4)
        assert.equal((await call('PUT', {...head, revision: 4})).status, 404)
        login('b')
        clock = Date.parse(LIMITED_IDEAS_END)
        assert.equal((await call()).status, 200)
        assert.equal((await call('POST', valid)).status, 201)
        users.b.role = '1'
        assert.equal((await call()).status, 403)
        assert.equal((await call('POST', valid)).status, 403)
        const history = await db.limitedIdea.findMany({where: {ruleId: original.ruleId}, orderBy: {revision: 'asc'}})
        assert.equal(history[0].body, valid.body)
        assert.equal(history[1].body, '<script>alert(1)</script>')
        assert.deepEqual(history.map(item => item.hidden), [false, false, false, true])
    } finally {
        await db.limitedIdea.deleteMany({})
        await db.$disconnect()
    }
})
