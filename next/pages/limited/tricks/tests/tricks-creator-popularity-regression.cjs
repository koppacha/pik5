const fs = require('fs')
const vm = require('vm')
const path = require('path')
const assert = require('node:assert/strict')
const nextRoot = path.resolve(__dirname, '../../../..')
const source = file => fs.readFileSync(path.join(nextRoot, file), 'utf8').replace(/^import .*\r?\n/gm, '').replace(/^export /gm, '').replace('default async function handle', 'async function handle')
const helper = vm.createContext({Map, Set, Array, Number})
vm.runInContext(source('lib/tricks/adminStats.js') + '\nthis.calculate = withCreatorPopularity', helper)
const users = [{userId: 'a', name: '作者甲'}, {userId: 'b', name: '作者乙'}, {userId: 'blank', name: ''}]
const card = {stage_id: 1201, taker: 'other', creator: '作者甲 ＆ 作者乙（共同案）', participants: ['p', 'p', 'q']}
const stats = {users: ['a', 'b', 'blank', 'missing'].map(user_id => ({user_id, popular_creator_index: 0})), cards: [card,
    {...card, stage_id: 1202, participants: ['p']},
    {...card, stage_id: 1203, creator: 'a', participants: ['p', 'q', 'r']},
    {...card, stage_id: null, participants: ['p', 'q', 'r']},
    {...card, taker: null, participants: ['p', 'q', 'r']},
    {...card, stage_id: 1204, creator: '作者甲', participants: []},
]}
const expected = helper.calculate(stats, users)
assert.deepEqual(expected.users.map(user => user.popular_creator_index), [3, 3, 0, 0])
assert.equal(stats.users[0].popular_creator_index, 0, 'must not mutate upstream stats')
assert.equal(helper.calculate(null, users), null)
let lookups = 0
async function proxy(status, route = 'tricks/collected/admin-stats') {
    const context = vm.createContext({process: {env: {TRICKS_INTERNAL_SECRET: 'synthetic-test-only'}}, URLSearchParams, Buffer,
        getServerSession: async () => ({user: {userId: 'test_admin', role: 10}}), authOptions: {},
        ensureServerApiAccess: () => true, stagingAccessEnabled: () => false, hasStagingAccess: () => true,
        tricksTestIdentityHeaders: () => ({}), tricksIdentityHeaders: () => ({}),
        getCachedUsers: async () => { lookups++
            return users }, withCreatorPopularity: helper.calculate,
        prisma: {}, networkInterfaces: () => ({}),
        fetch: async () => ({status, ok: status === 200, text: async () => JSON.stringify(stats)}),
    })
    vm.runInContext(source('pages/api/server/[...query].js') + '\nthis.handle = handle', context)
    let body
    let responseStatus
    const res = {setHeader: () => {}, status: code => { responseStatus = code
        return res }, json: value => {body = value
        return res}}
    await context.handle({method: 'GET', query: {query: route.split('/')}, headers: {}, socket: {}}, res)
    return {body, status: responseStatus}
}
async function run() {
    let result = await proxy(403)
    assert.equal(result.status, 403)
    assert.equal(lookups, 0, 'do not resolve names for denied requests')
    result = await proxy(200)
    assert.equal(result.status, 200)
    assert.deepEqual(Array.from(result.body.data.users, user => user.popular_creator_index), [3, 3, 0, 0])
    assert.equal(lookups, 1)
    result = await proxy(200, 'tricks/state')
    assert.equal(lookups, 1, 'do not touch other game endpoints')
    assert.equal(result.body.data.users[0].popular_creator_index, 0)
    console.log('Creator popularity: canonical names, co-authors, per-card uniqueness, missing names, taken cards, immutable data and authorized proxy checks passed')
}
run().catch(error => { console.error(error)
    process.exit(1) })
