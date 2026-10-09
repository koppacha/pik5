const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const {pathToFileURL} = require('url')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
require('dotenv').config({quiet: true})
const original = require.extensions['.js']
const root = process.cwd()
const load = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8').replace(/import\.meta\.url/g, JSON.stringify(pathToFileURL(filename).href))
    module._compile(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, filename)
}
require.extensions['.ts'] = load
require.extensions['.js'] = (module, filename) => filename.startsWith(path.join(root, 'lib')) ? load(module, filename) : original(module, filename)
const prisma = require(path.join(root, 'lib/prisma')).default
const base = 'http://localhost:3000'
const userId = 'codex_post_probe_990420'
const eventId = 990420
const stageId = Number(process.env.PIK5_TRICKS_POST_TEST_STAGE)
const cookies = new Map()
let created = false
async function request(url, options = {}) {
    const response = await fetch(base + url, {...options, headers: {cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), origin: base, referer: base + '/', ...options.headers}})
    for (const value of response.headers.getSetCookie()) {
        const pair = value.split(';')[0]
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
    return response
}
async function post(score, mode = 'create', uniqueId = '') {
    const form = new FormData()
    const fields = {stage_id: stageId, tricks_event_id: eventId, rule: eventId, region: 1,
        score, console: 1, difficulty: 1, video_url: '', post_comment: 'Synthetic post route verification',
        created_at: new Date().toISOString(), user_agent: 'codex dedicated probe', mode, edit_unique_id: uniqueId}
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value))
    const response = await request('/api/server/post', {method: 'POST', body: form})
    const body = await response.json()
    console.log(JSON.stringify({operation: mode, status: response.status, accepted: Array.isArray(body) && body[0] === 'OK', message: body.message}))
    if (response.status !== 200 || body[0] !== 'OK') throw new Error(`post verification HTTP ${response.status}`)
}
async function main() {
    if (!Number.isSafeInteger(stageId) || stageId < 1001 || stageId > 1999) throw new Error('Dedicated fixture stage is required')
    if (await prisma.user.findUnique({where: {userId}, select: {id: true}})) throw new Error('Probe user already exists; will not reuse')
    process.env.PIK5_POST_TEST_PASSWORD = crypto.randomBytes(32).toString('base64url')
    await prisma.user.create({data: {userId, name: 'Dedicated Post Probe', role: '0', password: await bcrypt.hash(process.env.PIK5_POST_TEST_PASSWORD, 10)}})
    created = true
    const csrfResponse = await request('/api/auth/csrf')
    const {csrfToken} = await csrfResponse.json()
    const form = new URLSearchParams({csrfToken, userId, password: process.env.PIK5_POST_TEST_PASSWORD, callbackUrl: base, json: 'true'})
    await request('/api/auth/callback/credentials', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: form, redirect: 'manual'})
    const session = await (await request('/api/auth/session')).json()
    if (session.user?.userId !== userId) throw new Error('Dedicated user login failed')
    await post(123)
    const scoresResponse = await request(`/api/server/tricks/cards/${process.env.PIK5_TRICKS_POST_TEST_DECK}/scores?event_id=${eventId}`)
    const scoresBody = await scoresResponse.json()
    const scores = scoresBody.data ?? scoresBody
    const record = scores.find(row => row.user_id === userId)
    if (!record?.unique_id) throw new Error('Posted unique ID missing')
    await post(124, 'edit', record.unique_id)
    const response = await request(`/api/server/delete/${record.unique_id}`, {method: 'DELETE'})
    console.log(JSON.stringify({operation: 'delete', status: response.status}))
    if (response.status !== 200) throw new Error('Delete route failed')
}
main().catch(error => {
    console.error(JSON.stringify({failed: true, name: error.name, code: error.code, message: error.name === 'Error' ? error.message : 'dependency failure'}))
    process.exitCode = 1
}).finally(async () => {
    if (created) await prisma.user.delete({where: {userId}})
    delete process.env.PIK5_POST_TEST_PASSWORD
    cookies.clear()
    await prisma.$disconnect()
})
