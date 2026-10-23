import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {parseRecordYear, yearWindow, evidenceUrl} from '../lib/yearRecords.mjs'
import {fetchYearSpeedruns, speedrunYearKey} from '../lib/yearSpeedruns.mjs'
import {cachedYearJson, invalidateYearJson} from '../lib/yearRecordsCache.mjs'

const configs = {101: {consoles: {1: {gameId: 'game', categoryId: 'category', variables: {'var-version': 'original'}}}}}
const now = new Date('2026-10-19T03:00:00Z')
const run = (id, submitted, time, extra = {}) => ({
    id, game: 'game', category: 'category', level: null,
    status: {status: 'verified', 'verify-date': submitted},
    submitted, times: {realtime_t: time}, players: [{id, names: {international: id}}],
    values: {version: 'original'}, videos: null, ...extra,
})
const response = data => ({data, pagination: {links: []}})
const fetchRuns = (data, year = 2025, definitions = configs) => fetchYearSpeedruns(year, definitions, {now, request: async () => response(data)})

test('strict year validation uses Japan year and year-end boundaries', () => {
    for (const invalid of ['2013', '2027', '02025', '2025x', '2025.0', '', ['2025'], null]) assert.equal(parseRecordYear(invalid, now), null)
    assert.equal(parseRecordYear('2014', now), 2014)
    assert.equal(parseRecordYear('2027', new Date('2026-12-31T15:00:00Z')), 2027)
    assert.equal(yearWindow(2025, now).cutoff.toISOString(), '2025-12-31T15:00:00.000Z')
    assert.equal(yearWindow(2014, now).start, null)
    assert.equal(yearWindow(2026, now).cutoff, now)
    assert.equal(evidenceUrl(' javascript:alert(1)'), null)
    assert.equal(evidenceUrl(' https://example.com/video '), 'https://example.com/video')
})

test('all pages are followed and duplicate run IDs do not create duplicate players', async () => {
    const next = 'https://www.speedrun.com/api/v1/runs?offset=200'
    let requests = 0
    const a = run('a', '2025-02-01T00:00:00Z', 100)
    const data = await fetchYearSpeedruns(2025, configs, {now, request: async url => {
        requests++
        return url === next ? response([a, run('b', '2025-03-01T00:00:00Z', 100)])
            : {data: [a], pagination: {links: [{rel: 'next', uri: next}]}}
    }})
    assert.equal(requests, 2)
    assert.deepEqual(data.boards[0].runs.map(record => record.rank), [1, 1])
})

test('PB selection precedes year filtering and retains ranking population', async () => {
    const data = await fetchRuns([
        run('old', '2024-01-01T00:00:00Z', 50),
        run('best', '2025-01-01T00:00:00Z', 100, {players: [{id: 'same'}]}),
        run('later-slower', '2025-12-01T00:00:00Z', 110, {players: [{id: 'same'}]}),
        run('future', '2025-12-31T15:00:00Z', 1),
    ])
    assert.deepEqual(data.boards[0].runs.map(record => [record.id, record.rank]), [['best', 2]])
})

test('submitted, rather than performed date, controls Japan-year selection', async () => {
    const data = await fetchRuns([
        run('first-second', '2024-12-31T15:00:00Z', 100, {date: '2024-01-01'}),
        run('last-second', '2025-12-31T14:59:59Z', 200, {date: '2026-01-01'}),
        run('unknown', null, 1),
    ])
    assert.deepEqual(data.boards[0].runs.map(record => record.id), ['first-second', 'last-second'])
    assert.equal(data.unknownDates, 1)
    const earliest = await fetchRuns([run('legacy', '2013-01-01T00:00:00Z', 100)], 2014)
    assert.equal(earliest.boards[0].runs[0].id, 'legacy')
})

test('unknown, unverified, NG+ and unrelated variable/category runs are excluded', async () => {
    const data = await fetchRuns([
        run('valid', '2025-01-01T00:00:00Z', 123.456),
        run('wrong-variable', '2025-01-01T00:00:00Z', 1, {values: {version: 'other'}}),
        run('new', '2025-01-01T00:00:00Z', 1, {status: {status: 'new'}}),
        run('late-verified', '2025-01-01T00:00:00Z', 1, {status: {status: 'verified', 'verify-date': '2026-01-01T00:00:00Z'}}),
        run('ng', '2025-01-01T00:00:00Z', 1, {values: {version: 'original', dloe59en: 'q650zkjl'}}),
        run('other-category', '2025-01-01T00:00:00Z', 1, {category: 'other'}),
        run('level', '2025-01-01T00:00:00Z', 1, {level: 'level'}),
    ])
    assert.deepEqual(data.boards[0].runs.map(record => record.id), ['valid'])
    assert.equal(data.boards[0].runs[0].time, 123.456)
})

test('guest names, multiple players and video evidence survive normalization', async () => {
    const data = await fetchRuns([run('relay', '2025-01-01T00:00:00Z', 100, {
        players: {data: [{rel: 'guest', name: 'Synthetic guest'}, {id: 'user', names: {japanese: '合成走者'}}]},
        videos: {links: [{uri: 'javascript:bad'}, {uri: 'https://example.com/video'}]},
    })])
    assert.deepEqual(data.boards[0].runs[0].players.map(player => player.name), ['Synthetic guest', '合成走者'])
    assert.equal(data.boards[0].runs[0].videoUrl, 'https://example.com/video')
})

test('overlapping console definitions share the game/category history request', async () => {
    let calls = 0
    const definitions = {101: {consoles: {...configs[101].consoles, 2: {gameId: 'game', categoryId: 'category', variables: {'var-version': 'other'}}}}}
    const data = await fetchYearSpeedruns(2025, definitions, {now, request: async () => {
        calls++
        return response([run('a', '2025-01-01T00:00:00Z', 100)])
    }})
    assert.equal(calls, 1)
    assert.equal(data.boards.length, 1)
    assert.notEqual(speedrunYearKey(2025, configs), speedrunYearKey(2025, definitions))
})

test('partial upstream errors, invalid JSON shape and pagination loops reject the entire result', async () => {
    await assert.rejects(fetchYearSpeedruns(2025, configs, {now, request: async () => {throw new Error('429')}}), /429/)
    await assert.rejects(fetchYearSpeedruns(2025, configs, {now, request: async () => ({})}), /Invalid speedrun response/)
    await assert.rejects(fetchYearSpeedruns(2025, configs, {now, request: async () => ({data: [], pagination: {links: [{rel: 'next', uri: 'https://evil.example/runs'}]}})}), /pagination URL/)
    const next = 'https://www.speedrun.com/api/v1/runs?offset=0'
    await assert.rejects(fetchYearSpeedruns(2025, configs, {now, request: async () => ({data: [], pagination: {links: [{rel: 'next', uri: next}]}})}), /pagination/)
})

test('file cache shares concurrent generation, survives memory, preserves stale success and refreshes explicitly', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'year-cache-test-'))
    const previous = process.env.YEAR_RECORD_CACHE_DIR
    process.env.YEAR_RECORD_CACHE_DIR = directory
    try {
        let calls = 0
        const produce = async () => {calls++; return {boards: [1]}}
        const pair = await Promise.all([cachedYearJson('sample', 60000, produce), cachedYearJson('sample', 60000, produce)])
        assert.equal(calls, 1)
        assert.deepEqual(pair[0], {boards: [1], stale: false})
        assert.deepEqual(await cachedYearJson('sample', 60000, produce), pair[0])
        assert.equal(calls, 1)
        await cachedYearJson('expired', -1, produce)
        assert.deepEqual(await cachedYearJson('expired', 60000, async () => {throw new Error('503')}), {boards: [1], stale: true})
        await invalidateYearJson('sample')
        await cachedYearJson('sample', 60000, produce)
        assert.equal(calls, 3)
        await assert.rejects(cachedYearJson('failed', 60000, async () => {throw new Error('503')}), /503/)
    } finally {
        if (previous === undefined) delete process.env.YEAR_RECORD_CACHE_DIR
        else process.env.YEAR_RECORD_CACHE_DIR = previous
        await rm(directory, {recursive: true, force: true})
    }
})
