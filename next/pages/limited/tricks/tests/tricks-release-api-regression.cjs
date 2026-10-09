const fs = require('fs')
const vm = require('vm')
const assert = require('node:assert/strict')
const path = require('path')
const nextRoot = path.resolve(__dirname, '../../../..')
const yup = require(path.join(nextRoot, 'node_modules/yup'))
const source = file => fs.readFileSync(path.join(nextRoot, file), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/^export /gm, '')
const schema = vm.createContext({yup, newUserEvidenceRequirements: {}, Date, Number, String, Array})
vm.runInContext(source('lib/recordValidation.js') + '\nthis.schema = createRecordValidationSchema', schema)
let checks = 0

async function run({score = 123, stageEvent = 251227, eventId = '251227', mode = 'create', action = 'post', role = 0, owner = 'release_test', allowed = true, now = Date.parse('2026-10-09T12:00:00+09:00'), badId = false, recordMissing = false} = {}) {
    let forwarded = 0
    const record = {unique_id: 123456789, stage_id: 1491, user_id: owner, flg: 0, created_at: new Date(now - 3600000).toISOString(), tricks_event_id: stageEvent}
    class Clock extends Date { static now() { return now } }
    const queries = []
    const prisma = {user: {findFirst: async () => ({role})}, $queryRaw: async (strings, ...values) => {
        const sql = strings.join('?')
        queries.push({sql, values})
        if (sql.includes('FROM records')) return recordMissing ? [] : [record]
        return stageEvent === null ? [] : [{event_id: stageEvent}]
    }}
    const helpers = vm.createContext({process: {env: {}}, encodeURIComponent, tricksIdentityHeaders: () => ({}), fetch: async url => {
        queries.push({url})
        const isRecord = url.includes('/record-context/')
        const requested = new URL(url).searchParams.get('event_id')
        const data = isRecord ? record : (stageEvent === null || (requested && Number(requested) !== stageEvent)) ? null : {event_id: stageEvent}
        const missing = isRecord && recordMissing
        return {ok: !missing, status: missing ? 404 : 200, json: async () => data}
    }, Date: Clock, Number, String, stagingAccessEnabled: id => Number(id) === 261001, hasStagingAccess: () => allowed, STAGING_CLOSE_AT: Date.parse('2026-10-06T22:00:00+09:00')})
    vm.runInContext(source('lib/tricks/recordContext.js') + '\nthis.helpers={findRecordForMutation,findTricksStageEvent,ensureRecordStagingAccess}', helpers)
    const fields = {stage_id: '1491', tricks_event_id: eventId, score: String(score), rule: '1', region: '1', console: '1', difficulty: '1', created_at: record.created_at, user_agent: 'synthetic-regression', mode, edit_unique_id: '123456789'}
    const context = vm.createContext({fs, FormData, Blob, Buffer, Date: Clock, URLSearchParams, Number, String, Promise, process: {env: {}},
        getServerSession: async () => ({user: {userId: 'release_test', role}}), authOptions: {}, ensureServerApiAccess: () => true, prismaLogging: async () => {}, prisma,
        formidable: () => ({parse: (req, cb) => cb(null, fields, {})}), tricksIdentityHeaders: () => ({}),
        createRecordValidationSchema: schema.schema, ...helpers.helpers,
        fetch: async (url, options) => {
            if (options?.method === 'POST' || options?.method === 'DELETE') forwarded++
            assert(!url.includes('/record/id/'), 'mutation must not use public lookup')
            const data = url.includes('/count/') ? {post_count: 100, first_posted_at: '2020-01-01'} : url.includes('/rank/') ? 1 : ['OK', 200]
            return {ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data}
        }
    })
    const file = action === 'delete' ? 'pages/api/server/delete/[...delete].js' : 'pages/api/server/post.js'
    const handler = source(file).replace('default async function handler', 'async function handler')
    vm.runInContext(handler + '\nthis.handler=handler', context)
    let status = 200
    const res = {setHeader: () => {}, status: value => { status = value
        return res }, json: () => res}
    await context.handler({method: action === 'delete' ? 'DELETE' : 'POST', query: {delete: [badId ? "1' OR 1=1" : '123456789']}, headers: {}, socket: {}}, res)
    return {status, forwarded, queries}
}

async function expect(options, status, forwarded) {
    const result = await run(options)
    assert.equal(result.status, status, JSON.stringify(options))
    assert.equal(result.forwarded, forwarded, JSON.stringify(options))
    checks++
}

async function main() {
    await expect({score: 100000}, 200, 1)
    await expect({score: 999999}, 200, 1)
    await expect({score: 1000000}, 400, 0)
    await expect({score: 83.5}, 400, 0)
    await expect({score: 999999, stageEvent: null, eventId: ''}, 400, 0)
    await expect({score: 999999, stageEvent: null, eventId: '251227'}, 400, 0)
    await expect({score: 99999, stageEvent: null, eventId: ''}, 200, 1)
    await expect({action: 'delete'}, 200, 1)
    await expect({action: 'delete', role: 10, owner: 'other_test'}, 200, 1)
    await expect({action: 'delete', owner: 'other_test'}, 403, 0)
    await expect({action: 'delete', badId: true}, 404, 0)
    await expect({action: 'delete', recordMissing: true}, 404, 0)
    await expect({mode: 'edit', stageEvent: 261001, eventId: '261001', allowed: false}, 200, 1)
    await expect({action: 'delete', stageEvent: 261001, allowed: false}, 200, 1)
    const before = Date.parse('2026-10-05T12:00:00+09:00')
    await expect({mode: 'edit', stageEvent: 251227, now: before, allowed: false}, 200, 1)
    await expect({action: 'delete', stageEvent: 251227, now: before, allowed: false}, 200, 1)
    await expect({mode: 'edit', stageEvent: 261001, eventId: '261001', now: before, allowed: false}, 403, 0)
    await expect({action: 'delete', stageEvent: 261001, now: before, allowed: false}, 403, 0)
    await expect({stageEvent: 261001, eventId: '261001', now: before, allowed: true}, 200, 1)
    console.log(`PASS ${checks} actual API handler/context regression cases`)
    for (const userId of ['_deck', '_FIELD', '_stack', '_trash', '_collected', '_excluded', '_alice']) {
        let created = false
        const context = vm.createContext({String, prisma: {user: {findFirst: async () => null, create: async () => { created = true
            return {} }}}, isValidPassword: () => true, bcrypt: {hashSync: () => 'synthetic-unused-hash'}, invalidateUsersCache: () => {}})
        vm.runInContext(source('pages/api/user/create.js').replace('default async function handle', 'async function handle') + '\nthis.handle=handle', context)
        let status = 200
        const res = {status: value => { status = value
            return res }, json: () => res}
        await context.handle({method: 'POST', body: {userId, name: 'Synthetic', password: ''}}, res)
        assert.equal(status, userId === '_alice' ? 200 : 400)
        assert.equal(created, userId === '_alice')
    }
    console.log('PASS 7 actual registration handler reserved/normal ID cases')
}
main().catch(error => { console.error(error)
    process.exitCode = 1 })
