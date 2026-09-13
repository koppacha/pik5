import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {parseLegacyLimitedIdeas, legacyRuleId, seedLegacyLimitedIdeas, validateLegacyFixture} from '../prisma/legacyLimitedIdeas.mjs'
import {createLimitedIdeasHandler} from '../lib/limitedIdeasApi'

const header = '| unique_id | stage_id | keyword | content | last_editor | created_at | updated_at | flag |'
const exportRow = (id, stage, name, body, editor, created, updated) => `| ${id} | ${stage} | ${name} | ${body} | ${editor} | ${created} | ${updated} | 1 |`
const fixture = {
    version: 1, sourceRowCount: 3, rules: [
        {sourceId: 'test-source-a', stageId: 201, ruleName: 'あ'.repeat(14), body: '本文'.repeat(150), creatorUserId: 'test-owner', createdAt: '2023-12-01T00:00:00.000Z', updatedAt: '2023-12-05T00:00:00.000Z'},
        {sourceId: 'test-source-b', stageId: 428, ruleName: 'テスト', body: 'スコアで競う', creatorUserId: 'shino15nome', createdAt: '2023-12-02T00:00:00.000Z', updatedAt: '2023-12-06T00:00:00.000Z'},
    ],
}

test('MySQL parser retains multiline/pipe content, newest owner and earliest creation in JST', () => {
    const parsed = parseLegacyLimitedIdeas([
        'mysql> select ...;', '+---+', header, '+---+',
        exportRow('same-id', 428, '最新', '行1 | 任意の文字\n行2', 'test-new-owner', '2023-12-03 09:00:00', '2023-12-04 10:00:00'),
        exportRow('same-id', 101, '過去', '旧データ', 'test-old-owner', '2023-12-01 09:00:00', '2023-12-02 10:00:00'),
        '+---+', '2 rows in set (0.00 sec)', 'mysql> ',
    ].join('\n'))
    assert.equal(parsed.sourceRowCount, 2)
    assert.equal(parsed.rules.length, 1)
    assert.deepEqual(parsed.rules[0], {sourceId: 'same-id', stageId: 428, ruleName: '最新', body: '行1 | 任意の文字\n行2', creatorUserId: 'test-new-owner', createdAt: '2023-12-01T00:00:00.000Z', updatedAt: '2023-12-04T01:00:00.000Z'})
    assert.equal(legacyRuleId('same-id'), legacyRuleId('same-id'))
    assert.notEqual(legacyRuleId('same-id'), legacyRuleId('other-id'))
})

test('invalid or partial exports and invalid fixtures stop before import', () => {
    const row = exportRow('id', 201, '名前', '本文', 'test-owner', '2023-12-01 00:00:00', '2023-12-02 00:00:00')
    assert.throws(() => parseLegacyLimitedIdeas(header + '\n' + row + '\ntruncated data'))
    assert.throws(() => parseLegacyLimitedIdeas(header + '\n' + row + '\n2 rows in set'))
    assert.throws(() => parseLegacyLimitedIdeas(header + '\n' + row.replace('2023-12-01', '2023-02-31')))
    assert.throws(() => validateLegacyFixture({...fixture, rules: [...fixture.rules, fixture.rules[0]]}))
    assert.throws(() => validateLegacyFixture({...fixture, rules: [{...fixture.rules[0], stageId: 101}]}))
    assert.doesNotThrow(() => validateLegacyFixture(fixture))
})

test('bundled export contains 48 valid rules deduplicated from 81 rows', async () => {
    const data = JSON.parse(await readFile(new URL('../prisma/fixtures/limited-ideas-legacy.json', import.meta.url), 'utf8'))
    validateLegacyFixture(data)
    assert.equal(data.sourceRowCount, 81)
    assert.equal(data.rules.length, 48)
    assert.equal(data.rules.filter(row => [...row.ruleName].length > 10).length, 3)
    assert.equal(new Set(data.rules.map(row => legacyRuleId(row.sourceId))).size, 48)
})

test('isolated MySQL import: dry-run, accounts, counts, ownership, length limits and safe rerun', {skip: !process.env.LIMITED_IDEAS_TEST_DATABASE_URL}, async () => {
    const url = new URL(process.env.LIMITED_IDEAS_TEST_DATABASE_URL)
    assert.equal(url.hostname, '127.0.0.1')
    assert.equal(url.pathname, '/limited_ideas_test')
    const {PrismaMariaDb} = await import('@prisma/adapter-mariadb')
    const {PrismaClient} = await import('../generated/prisma/client')
    const db = new PrismaClient({adapter: new PrismaMariaDb(url.toString())})
    let session = null
    const handler = createLimitedIdeasHandler({prisma: db, getSession: async () => session, now: () => Date.parse('2026-09-14T00:00:00+09:00'), siteUrl: 'http://localhost:3005'})
    const call = async (method, body, query = {}) => {
        const result = {}
        const res = {setHeader() {}, status(value) { result.status = value
            return this }, json(value) { result.data = value
            return this }}
        await handler({method, body, query, headers: {origin: 'http://localhost:3005', 'content-type': 'application/json'}}, res)
        return result
    }
    try {
        await db.limitedIdea.deleteMany({})
        await db.user.deleteMany({})
        const owner = await db.user.create({data: {userId: 'test-owner', name: 'テスト発案者', role: '1'}})
        const admin = await db.user.create({data: {userId: 'test-admin', name: 'テスト管理者', role: '10'}})
        const other = await db.user.create({data: {userId: 'test-other', name: 'テスト第三者', role: '1'}})
        const original = await db.limitedIdea.create({data: {ruleId: '11111111-1111-4111-8111-111111111111', currentKey: '11111111-1111-4111-8111-111111111111', revision: 1, creatorId: owner.id, creatorName: owner.name, editorId: owner.id, title: 2, stageId: 201, ruleName: '既存', body: '保持対象', difficulty: 1, registrationMethod: 'score'}})
        const dry = await seedLegacyLimitedIdeas(db, fixture, {dryRun: true})
        assert.equal(dry.toCreate, 2)
        assert.equal(dry.usersToCreate, 1)
        assert.equal(dry.expectedVisibleAfter, 3)
        assert.equal(await db.user.count(), 3)
        assert.equal(await db.limitedIdea.count(), 1)
        const first = await seedLegacyLimitedIdeas(db, fixture)
        assert.equal(first.created, 2)
        assert.equal(first.activeImported, 2)
        assert.equal(first.visibleAfter, 3)
        const placeholder = await db.user.findUnique({where: {userId: 'shino15nome'}, select: {id: true, name: true, password: true, role: true}})
        assert.equal(placeholder.password, null)
        assert.equal(placeholder.role, '')
        assert.deepEqual(await db.limitedIdea.findUnique({where: {currentKey: original.ruleId}}), original)
        const imported = await db.limitedIdea.findUnique({where: {currentKey: legacyRuleId('test-source-a')}})
        assert.equal(imported.creatorId, owner.id)
        assert.equal(imported.editorId, owner.id)
        assert.equal(imported.ruleName, fixture.rules[0].ruleName)
        assert.equal(imported.body, fixture.rules[0].body)
        assert.equal(imported.createdAt.toISOString(), fixture.rules[0].createdAt)
        assert.equal(imported.updatedAt.toISOString(), fixture.rules[0].updatedAt)
        assert.equal(imported.difficulty, 1)
        assert.equal(imported.registrationMethod, 'score')
        session = {user: {dbId: owner.id}}
        const mine = await call('GET', undefined, {view: 'mine'})
        assert.equal(mine.data.ownCount, 2)
        assert.equal((await call('GET')).data.count, 3)
        assert.equal((await call('PUT', imported)).status, 400)
        assert.equal((await call('PUT', {...imported, ruleName: '短い名前'})).status, 400)
        const edited = await call('PUT', {...imported, ruleName: '短い名前', body: '短い本文'})
        assert.equal(edited.status, 200)
        session = {user: {dbId: admin.id}}
        assert.equal((await call('GET', undefined, {view: 'mine'})).data.count, 3)
        const adminEdit = await call('PUT', {...edited.data.item, body: '管理者による編集'})
        assert.equal(adminEdit.status, 200)
        const current = await db.limitedIdea.findUnique({where: {currentKey: imported.ruleId}})
        assert.equal(current.creatorId, owner.id)
        assert.equal(current.editorId, admin.id)
        assert.equal(current.legacyId, 'test-source-a')
        session = {user: {dbId: other.id}}
        assert.equal((await call('PUT', adminEdit.data.item)).status, 404)
        assert.equal((await call('DELETE', adminEdit.data.item)).status, 404)
        session = {user: {dbId: owner.id}}
        assert.equal((await call('DELETE', adminEdit.data.item)).status, 200)
        await db.user.update({where: {id: placeholder.id}, data: {name: '既存ユーザー名'}})
        const rerun = await seedLegacyLimitedIdeas(db, fixture)
        assert.equal(rerun.created, 0)
        assert.equal(rerun.alreadyImported, 2)
        assert.equal(rerun.activeImported, 1)
        assert.equal(rerun.visibleAfter, 2)
        assert.equal((await db.user.findUnique({where: {id: placeholder.id}})).name, '既存ユーザー名')
        assert.equal(await db.limitedIdea.count({where: {ruleId: imported.ruleId}}), 4)
        assert.deepEqual(await db.limitedIdea.findUnique({where: {currentKey: original.ruleId}}), original)
        await assert.rejects(seedLegacyLimitedIdeas(db, {...fixture, rules: [{...fixture.rules[0], sourceId: 'new-rule', creatorUserId: 'missing-test-user'}]}))
        assert.equal(await db.limitedIdea.count({where: {legacyId: 'new-rule'}}), 0)
    } finally {
        await db.limitedIdea.deleteMany({})
        await db.user.deleteMany({})
        await db.$disconnect()
    }
})
