import {createHash} from 'node:crypto'

const datePattern = '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}'
const visible = {currentKey: {not: null}, hidden: false}

function sourceDate(value) {
    const timestamp = new Date(value.replace(' ', 'T') + '+09:00')
    if (!Number.isFinite(timestamp.getTime()) || new Date(timestamp.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) {
        throw new Error('Invalid legacy timestamp')
    }
    return timestamp.toISOString()
}

export function legacyRuleId(sourceId) {
    const bytes = createHash('sha256').update(`pik5:legacy-limited-ideas:${sourceId}`).digest().subarray(0, 16)
    bytes[6] = (bytes[6] & 15) | 128
    bytes[8] = (bytes[8] & 63) | 128
    const hex = bytes.toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// MySQL table output can contain physical newlines and literal pipes inside content.
// Treat every field as data, never as SQL, Markdown instructions or executable code.
export function parseLegacyLimitedIdeas(text) {
    const header = text.split(/\r?\n/).find(line => line.startsWith('| unique_id'))
    if (JSON.stringify(header?.split('|').slice(1, -1).map(value => value.trim())) !== JSON.stringify([
        'unique_id', 'stage_id', 'keyword', 'content', 'last_editor', 'created_at', 'updated_at', 'flag',
    ])) throw new Error('Unexpected MySQL export header')

    const pattern = new RegExp(`^\\|[ \\t]*([^|\\r\\n]+?)[ \\t]*\\|[ \\t]*(\\d+)[ \\t]*\\|[ \\t]*([^|\\r\\n]*?)[ \\t]*\\| (.*?)\\|[ \\t]*([^|\\r\\n]+?)[ \\t]*\\|[ \\t]*(${datePattern})[ \\t]*\\|[ \\t]*(${datePattern})[ \\t]*\\|[ \\t]*(\\d+)[ \\t]*\\|[ \\t]*\\r?$`, 'gms')
    const matches = [...text.matchAll(pattern)]
    const remainder = text.replace(pattern, '').split(/\r?\n/).filter(line => line.trim() && line !== header && !/^\+[-+]+\+$/.test(line) && !/^\d+ rows? in set.*$/.test(line) && !/^mysql>.*$/.test(line))
    if (!matches.length || remainder.length) throw new Error('Unparsed data in MySQL export')
    const reportedCount = text.match(/^(\d+) rows? in set.*$/m)
    if (reportedCount && Number(reportedCount[1]) !== matches.length) throw new Error('MySQL row count mismatch')

    const grouped = new Map()
    for (const match of matches) {
        const [sourceId, stage, ruleName, body, creatorUserId, created, updated, flag] = match.slice(1).map(value => value.trim())
        if (flag !== '1') throw new Error('Unexpected legacy visibility flag')
        const row = {sourceId, stageId: Number(stage), ruleName, body, creatorUserId, createdAt: sourceDate(created), updatedAt: sourceDate(updated)}
        const previous = grouped.get(sourceId)
        if (!previous) {
            grouped.set(sourceId, row)
            continue
        }
        const createdAt = previous.createdAt < row.createdAt ? previous.createdAt : row.createdAt
        if (previous.updatedAt === row.updatedAt && ['stageId', 'ruleName', 'body', 'creatorUserId'].some(key => previous[key] !== row[key])) {
            throw new Error('Conflicting rows share the newest timestamp')
        }
        grouped.set(sourceId, {...(previous.updatedAt >= row.updatedAt ? previous : row), createdAt})
    }
    const result = {version: 1, sourceRowCount: matches.length, rules: [...grouped.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId))}
    validateLegacyFixture(result)
    return result
}

export function validateLegacyFixture(fixture) {
    if (fixture?.version !== 1 || !Array.isArray(fixture.rules) || !fixture.rules.length || !Number.isSafeInteger(fixture.sourceRowCount) || fixture.sourceRowCount < fixture.rules.length) throw new Error('Invalid legacy fixture')
    const ids = new Set()
    for (const row of fixture.rules) {
        if (typeof row.sourceId !== 'string' || !row.sourceId || row.sourceId.length > 191 || ids.has(row.sourceId)) throw new Error('Invalid or duplicate legacy ID')
        ids.add(row.sourceId)
        if (!Number.isInteger(row.stageId) || !(row.stageId >= 201 && row.stageId <= 230 || row.stageId >= 401 && row.stageId <= 428)) throw new Error('Unsupported latest legacy stage')
        if (typeof row.creatorUserId !== 'string' || !row.creatorUserId || row.creatorUserId.length > 191) throw new Error('Invalid legacy creator')
        if (typeof row.ruleName !== 'string' || !row.ruleName.trim() || Buffer.byteLength(row.ruleName) > 65535) throw new Error('Invalid legacy rule name')
        if (typeof row.body !== 'string' || !row.body.trim() || Buffer.byteLength(row.body) > 16777215) throw new Error('Invalid legacy body')
        if (![row.createdAt, row.updatedAt].every(value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value) || row.createdAt > row.updatedAt) throw new Error('Invalid fixture timestamp')
    }
}

export async function seedLegacyLimitedIdeas(prisma, fixture, {dryRun = false} = {}) {
    validateLegacyFixture(fixture)
    return prisma.$transaction(async tx => {
        const before = await tx.limitedIdea.count({where: visible})
        const users = new Map()
        const missing = []
        for (const userId of new Set(fixture.rules.map(row => row.creatorUserId))) {
            const user = await tx.user.findUnique({where: {userId}, select: {id: true, userId: true, name: true}})
            if (user) users.set(userId, user)
            else if (userId === 'shino15nome') missing.push(userId)
            else throw new Error(`Creator account is missing: ${userId}`)
        }
        const ids = fixture.rules.map(row => legacyRuleId(row.sourceId))
        const existing = await tx.limitedIdea.findMany({where: {ruleId: {in: ids}, revision: 1}, select: {ruleId: true, legacyId: true}})
        const existingById = new Map(existing.map(row => [row.ruleId, row]))
        for (const row of fixture.rules) {
            const previous = existingById.get(legacyRuleId(row.sourceId))
            if (previous && previous.legacyId !== row.sourceId) throw new Error('Legacy rule ID collision')
        }
        const pending = fixture.rules.filter(row => !existingById.has(legacyRuleId(row.sourceId)))
        if (dryRun) return {dryRun: true, sourceRows: fixture.sourceRowCount, sourceRules: fixture.rules.length, toCreate: pending.length, alreadyImported: existing.length, usersToCreate: missing.length, visibleBefore: before, expectedVisibleAfter: before + pending.length}

        for (const userId of missing) {
            // No password, email or privileges are invented. Existing production accounts are untouched.
            const user = await tx.user.upsert({where: {userId}, update: {}, create: {userId, name: userId, role: '', password: null}, select: {id: true, userId: true, name: true}})
            users.set(userId, user)
        }
        for (const row of pending) {
            const user = users.get(row.creatorUserId)
            const ruleId = legacyRuleId(row.sourceId)
            await tx.limitedIdea.create({data: {
                ruleId, currentKey: ruleId, revision: 1, legacyId: row.sourceId,
                creatorId: user.id, creatorName: user.name || row.creatorUserId, editorId: user.id,
                title: Math.floor(row.stageId / 100), stageId: row.stageId,
                ruleName: row.ruleName, body: row.body, difficulty: 1, registrationMethod: 'score',
                hidden: false, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
            }})
        }
        const importedRules = await tx.limitedIdea.count({where: {ruleId: {in: ids}, revision: 1}})
        const activeImported = await tx.limitedIdea.count({where: {...visible, ruleId: {in: ids}}})
        const after = await tx.limitedIdea.count({where: visible})
        if (importedRules !== fixture.rules.length || after !== before + pending.length) throw new Error('Import count verification failed')
        return {sourceRows: fixture.sourceRowCount, sourceRules: fixture.rules.length, created: pending.length, alreadyImported: existing.length, usersCreated: missing.length, activeImported, visibleBefore: before, visibleAfter: after, otherVisibleRules: after - activeImported}
    }, {isolationLevel: 'Serializable', maxWait: 10000, timeout: 60000})
}
