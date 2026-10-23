import {mkdir, open, readFile, rename, rm, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'

const pending = new Map()
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const root = () => process.env.YEAR_RECORD_CACHE_DIR || path.join(process.cwd(), '.cache', 'year-records')
const filename = key => {
    if (!/^[a-zA-Z0-9-]+$/.test(key)) throw new Error('Invalid cache key')
    return path.join(root(), `${key}.json`)
}

async function read(filename) {
    try {
        return JSON.parse(await readFile(filename, 'utf8'))
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
        throw error
    }
}

async function locked(file, action) {
    await mkdir(path.dirname(file), {recursive: true})
    const lock = `${file}.lock`
    const deadline = Date.now() + 60000
    let handle
    while (!handle) {
        try {
            handle = await open(lock, 'wx')
        } catch (error) {
            if (error.code !== 'EEXIST') throw error
            const info = await stat(lock).catch(() => null)
            if (info && Date.now() - info.mtimeMs > 300000) await rm(lock, {force: true})
            if (Date.now() > deadline) throw new Error('Year cache is busy')
            await delay(100)
        }
    }
    try {
        return await action()
    } finally {
        await handle.close()
        await rm(lock, {force: true})
    }
}

export async function cachedYearJson(key, ttl, produce) {
    if (pending.has(key)) return pending.get(key)
    const task = (async () => {
        const file = filename(key)
        const saved = await read(file)
        if (saved && saved.expiresAt > Date.now()) return {...saved.data, stale: false}
        try {
            return await locked(file, async () => {
                const recent = await read(file)
                if (recent && recent.expiresAt > Date.now()) return {...recent.data, stale: false}
                const data = await produce()
                const temporary = `${file}.${randomUUID()}.tmp`
                try {
                    await writeFile(temporary, JSON.stringify({expiresAt: Date.now() + ttl, data}))
                    await rename(temporary, file)
                } finally {
                    await rm(temporary, {force: true})
                }
                return {...data, stale: false}
            })
        } catch (error) {
            if (saved) return {...saved.data, stale: true}
            throw error
        }
    })()
    pending.set(key, task)
    try {
        return await task
    } finally {
        pending.delete(key)
    }
}

export async function invalidateYearJson(key) {
    await pending.get(key)?.catch(() => {})
    const file = filename(key)
    await locked(file, () => rm(file, {force: true}))
}
