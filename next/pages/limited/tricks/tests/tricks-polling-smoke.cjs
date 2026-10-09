async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const player = {name: 'polling_dummy', total_rank_points: 3, draw_points: 20, card_count: 2, hand_limit: 6, take_cost: 2}
    const card = {id: 991001, event_card_id: 991001, stage_id: 1499, title: 'ポーリング検証カード', rule_name: '合成ルール', text: '合成データのみ', difficulty: 1, rarity: 1, creator: '架空作者', stack_count: 2}
    let authenticated = false
    let state = {tournament: {event_id: 990499, title: 'ポーリング検証', state: 'active', available: true, debug: true, end_at: '2099-01-01T00:00:00+09:00'}, debug_state: {frozen: false}, me: null, players: [player, {...player, name: 'polling_dummy_b'}, {...player, name: 'polling_dummy_c'}], field: [{...card, taker: player.name, limit_at: '2099-01-01T00:00:00+09:00'}], hand: [], deck_count: 70, logs: []}
    const stateRequests = []
    await page.addInitScript(() => {
        if (window.__POLLING_TEST__) return
        const originalSet = window.setInterval.bind(window)
        const originalClear = window.clearInterval.bind(window)
        const clocks = new Set()
        window.__POLLING_TEST__ = {ticks: 0, clocks}
        window.setInterval = (callback, delay, ...args) => {
            const timer = originalSet(typeof callback === 'function' && delay === 1000 ? (...values) => {
                window.__POLLING_TEST__.ticks += 1
                callback(...values)
            } : callback, delay, ...args)
            if (delay === 1000) clocks.add(timer)
            return timer
        }
        window.clearInterval = timer => {
            clocks.delete(timer)
            return originalClear(timer)
        }
    })
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = authenticated ? {user: {userId: player.name, role: 0}, expires: '2099-01-01'} : {}
        else if (path === '/api/users') json = state.players.map(p => ({userId: p.name, name: p.name}))
        else if (path.endsWith('/state')) {
            stateRequests.push(Date.now())
            json = {...state, server_now: new Date().toISOString()}
        } else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.endsWith('/scores') || path.endsWith('/collected')) json = []
        else if (path.endsWith('/take')) {
            state = {...state, hand: [], field: [{...card, taker: player.name, limit_at: '2099-01-01T00:00:00+09:00'}]}
            json = {card: state.field[0]}
        }
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/tricks')
    await page.locator('canvas').first().waitFor()
    await page.getByRole('button', {name: '観戦する', exact: true}).click()
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping === true)
    await page.waitForTimeout(500)
    const before = await page.evaluate(() => ({...window.__TRICKS_DEBUG_SNAPSHOT__(), ticks: window.__POLLING_TEST__.ticks}))
    const requestStart = stateRequests.length
    await page.waitForTimeout(10500)
    const after = await page.evaluate(() => ({...window.__TRICKS_DEBUG_SNAPSHOT__(), ticks: window.__POLLING_TEST__.ticks}))
    const intervals = stateRequests.slice(requestStart).slice(1).map((time, i) => time - stateRequests[requestStart + i])
    assert(stateRequests.length - requestStart >= 3, '毎秒の時計更新中も3秒ポーリング継続')
    assert(after.ticks - before.ticks >= 9, '時計を止めずに検証')
    assert(intervals.every(interval => interval >= 2800 && interval < 4500), '取得間隔は約3秒で過密化しない')
    assert(after.phaserRenderCount === before.phaserRenderCount && after.phaserLoopSleeping, '状態が同じならCanvas全再描画なし')
    assert(after.domCards === before.domCards && after.domNodes === before.domNodes && after.canvasCount === before.canvasCount, 'DOMやCanvas増殖なし')
    assert(Number(after.activeRaf || 0) === 0 && Number(after.activeTimers || 0) === 0, '描画用RAFとタイマーが残らない')
    state = {...state, players: [{...player, draw_points: 23}, ...state.players.slice(1)]}
    await page.locator(`[data-tricks-player="${player.name}"] [data-tricks-subsidy-flag] strong`).filter({hasText: '23'}).waitFor()
    state = {...state, tournament: {...state.tournament, state: 'ended', available: false}}
    await page.locator('[data-testid="tricks-collected-results"]').waitFor()
    const endedCount = stateRequests.length
    await page.waitForTimeout(6500)
    assert(stateRequests.length === endedCount, '終了後はstateポーリング停止')

    // 実際のテイク操作を通じて一時停止と演出後の再開を確認する。
    authenticated = true
    state = {...state, tournament: {...state.tournament, state: 'active', available: true}, me: player, hand: [card, {...card, id: 991002}], field: []}
    await page.reload()
    await page.locator('.tricks-dom-card-hand').first().click()
    await page.evaluate(() => { window.confirm = () => true })
    await page.getByRole('button', {name: '場に出す', exact: true}).click()
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.activeTimers > 0)
    const duringTake = stateRequests.length
    await page.waitForTimeout(350)
    // テイク処理自身のmutate()による1回の明示更新は許容する。
    assert(stateRequests.length - duringTake <= 1, 'テイク演出中に明示更新以外の取得が増えない')
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.activeTimers === 0)
    const afterTake = stateRequests.length
    await page.waitForTimeout(3600)
    assert(stateRequests.length > afterTake, 'テイク演出後にポーリング再開')
    await page.screenshot({path: 'output/playwright/tricks-polling-fixed.png'})
    const routerAvailable = await page.evaluate(() => typeof window.next?.router?.push === 'function')
    assert(routerAvailable, 'Nextルーターによるアンマウント検証が可能')
    const eventClocks = await page.evaluate(() => Array.from(window.__POLLING_TEST__.clocks))
    await page.evaluate(() => window.next.router.push('/'))
    await page.waitForURL('http://localhost:3005/')
    const unmountedCount = stateRequests.length
    await page.waitForTimeout(6500)
    assert(stateRequests.length === unmountedCount, '画面離脱後は取得停止')
    assert(await page.evaluate(() => !window.__TRICKS_DEBUG_SNAPSHOT__), '画面離脱でdebug snapshotを破棄')
    assert(await page.evaluate(timers => timers.every(timer => !window.__POLLING_TEST__.clocks.has(timer)), eventClocks), '画面離脱で大会の毎秒時計タイマーを破棄')
    return {passed: 'clock + 3s polling, live update, ended stop, take pause/resume, unmount cleanup, canvas idle', intervals, before, after, stateRequests: stateRequests.length}
}
