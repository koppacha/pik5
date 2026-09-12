import {randomUUID} from 'node:crypto'
import {canAccessLimitedIdeas, isLimitedIdeasAdmin, LIMITED_IDEAS_END, validateLimitedIdea} from './limitedIdeas'

const currentVisible = {currentKey: {not: null}, hidden: false}
const publicFields = {
    ruleId: true, revision: true, title: true, stageId: true, ruleName: true,
    difficulty: true, registrationMethod: true, body: true, creatorName: true,
    updatedAt: true,
}
const fail = (status, message) => Object.assign(new Error(message), {status})

// Require a browser Origin for every mutation, even when an API access cookie exists.
export function isLimitedIdeasSameOrigin(req, configuredUrl) {
    try {
        if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false
        const expected = configuredUrl || `http://${req.headers.host}`
        return new URL(req.headers.origin).origin === new URL(expected).origin
    } catch {
        return false
    }
}

export function createLimitedIdeasHandler({prisma, getSession, now = Date.now, siteUrl}) {
    return async function handler(req, res) {
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('Vary', 'Cookie')
        if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
            res.setHeader('Allow', 'GET, POST, PUT, DELETE')
            return res.status(405).json({message: '許可されていないメソッドです。'})
        }
        try {
            const session = await getSession(req, res)
            // Do not trust role, userId or creator/editor fields supplied by the client/JWT.
            const user = session?.user?.dbId ? await prisma.user.findUnique({
                where: {id: session.user.dbId}, select: {id: true, name: true, role: true},
            }) : null
            if (!canAccessLimitedIdeas(user, now())) throw fail(403, '現在は募集期間外です。')
            const admin = isLimitedIdeasAdmin(user)

            if (req.method === 'GET' && req.query.view !== 'mine') {
                const count = await prisma.limitedIdea.count({where: currentVisible})
                return res.status(200).json({count, admin, closesAt: new Date(Date.parse(LIMITED_IDEAS_END) - 1000).toISOString()})
            }
            if (!user) throw fail(401, 'ログインが必要です。')
            if (req.method === 'GET') {
                const page = Number(req.query.page ?? 0)
                if (!Number.isSafeInteger(page) || page < 0 || page > 100000) throw fail(400, 'ページ番号が不正です。')
                const where = {...currentVisible, ...(!admin && {creatorId: user.id})}
                const [items, count, ownCount] = await Promise.all([
                    prisma.limitedIdea.findMany({where, select: publicFields, orderBy: [{updatedAt: 'desc'}, {ruleId: 'asc'}], skip: page * 50, take: 50}),
                    prisma.limitedIdea.count({where}),
                    prisma.limitedIdea.count({where: {...currentVisible, creatorId: user.id}}),
                ])
                return res.status(200).json({items, count, ownCount, admin})
            }
            if (!isLimitedIdeasSameOrigin(req, siteUrl)) throw fail(403, '送信元を確認できませんでした。')
            if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw fail(415, 'JSON形式で送信してください。')
            const input = req.body
            if (req.method !== 'DELETE') {
                const error = validateLimitedIdea(input)
                if (error) throw fail(400, error)
            }
            const fields = req.method !== 'DELETE' && {
                title: input.title, stageId: input.stageId, ruleName: input.ruleName.trim(),
                difficulty: input.difficulty, registrationMethod: input.registrationMethod, body: input.body.trim(),
            }
            if (req.method === 'POST') {
                const ruleId = randomUUID()
                const timestamp = new Date(now())
                const item = await prisma.limitedIdea.create({data: {
                    ...fields, ruleId, currentKey: ruleId, revision: 1,
                    creatorId: user.id, creatorName: user.name || '', editorId: user.id,
                    createdAt: timestamp, updatedAt: timestamp,
                }, select: publicFields})
                return res.status(201).json({item})
            }
            if (typeof input?.ruleId !== 'string' || !/^[0-9a-f-]{36}$/.test(input.ruleId) || !Number.isSafeInteger(input.revision) || input.revision < 1) throw fail(400, 'ルールIDまたはリビジョンが不正です。')
            const item = await prisma.$transaction(async tx => {
                const previous = await tx.limitedIdea.findUnique({where: {currentKey: input.ruleId}})
                if (!previous || previous.hidden || (!admin && previous.creatorId !== user.id)) throw fail(404, 'ルールが見つかりません。')
                if (previous.revision !== input.revision) throw fail(409, '他の編集が保存されています。一覧を更新して開き直してください。')
                // Claim the current revision atomically. A concurrent edit cannot overwrite it.
                const claimed = await tx.limitedIdea.updateMany({
                    where: {ruleId: input.ruleId, revision: input.revision, currentKey: input.ruleId},
                    data: {currentKey: null},
                })
                if (claimed.count !== 1) throw fail(409, '他の編集が保存されています。一覧を更新して開き直してください。')
                return tx.limitedIdea.create({data: {
                    ...previous, ...(fields || {}), revision: previous.revision + 1,
                    currentKey: previous.ruleId, editorId: user.id, updatedAt: new Date(now()),
                    hidden: req.method === 'DELETE',
                }, select: publicFields})
            })
            return res.status(200).json({item})
        } catch (error) {
            const conflict = ['P2002', 'P2034'].includes(error.code)
            const status = error.status || (conflict ? 409 : 500)
            return res.status(status).json({message: error.status ? error.message : conflict ? '更新が競合しました。一覧を更新して開き直してください。' : '処理に失敗しました。時間をおいて再度お試しください。'})
        }
    }
}
