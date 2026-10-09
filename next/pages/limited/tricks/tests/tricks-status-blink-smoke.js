async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    await page.unrouteAll()
    const a = {name: 'blink_test_a', total_rank_points: 10, draw_points: 8, card_count: 3, hand_limit: 6, collected_card_count: 2}
    const b = {...a, name:'blink_test_b', total_rank_points: 5}
    const c = {...a, name:'blink_test_c', total_rank_points: 1}
    let state = {tournament:{event_id:990408,title:'点滅検証',state:'active',available:true,end_at:'2099-01-01T00:00:00+09:00'},debug_state:{frozen:true},server_now:'2026-10-08T12:00:00+09:00',me:a,players:[a,b,c],field:[],hand:[],deck_count:17,logs:[]}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user:{userId:a.name,role:0},expires:'2099-01-01'}
        else if (path === '/api/users') json = [a,b,c].map(player => ({userId:player.name,name:player.name}))
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/holders')) json = {historical_counts:{}}
        else if (path.endsWith('/collected')) json = []
        await route.fulfill({json})
    })
    await page.setViewportSize({width:1440,height:1000})
    await page.goto('http://localhost:3005/limited/trick')
    const player = name => page.locator(`[data-tricks-player="${name}"]`)
    await player(a.name).waitFor()
    await page.clock.install()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
    await page.evaluate(() => {
        const pending = new Set()
        const set = window.setTimeout.bind(window)
        const clear = window.clearTimeout.bind(window)
        window.setTimeout = (callback, delay, ...args) => {
            if (delay !== 1800) return set(callback, delay, ...args)
            const timer = set(() => { pending.delete(timer); callback(...args) }, delay)
            pending.add(timer)
            return timer
        }
        window.clearTimeout = timer => { pending.delete(timer); clear(timer) }
        window.__TRICKS_TEST_BLINK_TIMERS__ = () => pending.size
    })
    assert(await page.locator('[data-tricks-stat-blink],[data-tricks-player-blink]').count() === 0, '初回表示では点滅なし')
    state = {...state, players:[{...a,total_rank_points:11},{...b,draw_points:9,card_count:4,collected_card_count:3},c]}
    await page.clock.fastForward(3100)
    const rp = player(a.name).locator('[data-tricks-stat-blink="rp"]')
    await rp.waitFor()
    for (const key of ['dp','hand','collected']) assert(await player(b.name).locator(`[data-tricks-stat-blink="${key}"]`).count() === 1, `${key}のみ点滅`)
    assert(await page.locator('[data-tricks-player-blink]').count() === 0, '順位不変ならブロック点滅なし')
    assert(await player(c.name).locator('[data-tricks-stat-blink]').count() === 0, '未変化プレイヤーは点滅なし')
    const duration = await rp.evaluate(el => parseFloat(getComputedStyle(el).animationDuration))
    assert(Math.abs(duration - 1 / 3) < .001, '周期333.333ms')
    await page.screenshot({path:'output/playwright/tricks-status-cell-blink.png'})
    await page.clock.runFor(1799)
    assert(await rp.count() === 1, '1799msは点滅継続')
    await page.clock.runFor(1)
    assert(await page.locator('[data-tricks-stat-blink]').count() === 0, '1800msで全項目終了')
    assert(await page.evaluate(() => window.__TRICKS_TEST_BLINK_TIMERS__()) === 0, '項目終了でタイマーなし')
    state = {...state, players:[state.players[0],{...state.players[1],total_rank_points:12},c]}
    await page.clock.fastForward(3100)
    await page.locator(`[data-tricks-player="${a.name}"][data-tricks-player-blink="change"]`).waitFor()
    assert(await player(b.name).getAttribute('data-tricks-player-blink') === 'change', '順位が変わった両者を全体点滅')
    assert(await player(c.name).getAttribute('data-tricks-player-blink') === null, '順位不変の他者は点滅なし')
    assert(await player(b.name).locator('[data-tricks-stat-blink]').count() === 0, '全体点滅中は項目との二重点滅なし')
    await page.clock.runFor(500)
    assert(await player(b.name).getAttribute('data-tricks-player-rank') === '1', 'RP順に順位入替')
    await page.screenshot({path:'output/playwright/tricks-status-rank-blink.png'})
    await page.clock.runFor(1300)
    assert(await page.locator('[data-tricks-stat-blink],[data-tricks-player-blink]').count() === 0, '順位演出も1800msで終了')
    state = {...state,players:[{...state.players[0],draw_points:10},state.players[1],c]}
    await page.clock.fastForward(3100)
    const dp = player(a.name).locator('[data-tricks-stat-blink="dp"]')
    await dp.waitFor()
    await page.clock.runFor(900)
    state = {...state,players:[{...state.players[0],draw_points:11},state.players[1],c]}
    const drawResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/draw'))
    await page.getByRole('button',{name:'ドロー',exact:true}).dispatchEvent('click')
    await drawResponse
    await page.clock.runFor(20)
    await player(a.name).locator('[data-tricks-stat-blink="dp"] strong').filter({hasText:'11'}).waitFor()
    await page.clock.runFor(900)
    assert(await dp.count() === 1, '再変化でその項目の期限を延長')
    await page.clock.runFor(1000)
    assert(await dp.count() === 0, '再変化から1800msで終了')
    state = {...state,players:[{...state.players[0],draw_points:12},state.players[1],c]}
    await page.clock.fastForward(3100)
    await dp.waitFor()
    state = {...state,tournament:{...state.tournament,event_id:990409},players:[{...state.players[0],total_rank_points:20},state.players[1],c]}
    const resetResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/draw'))
    await page.getByRole('button',{name:'ドロー',exact:true}).dispatchEvent('click')
    await resetResponse
    await page.clock.runFor(20)
    await player(a.name).locator('[data-tricks-player-rank-points] strong').filter({hasText:'20'}).waitFor()
    assert(await page.locator('[data-tricks-stat-blink],[data-tricks-player-blink]').count() === 0, '大会変更は旧点滅を解除し新規演出なし')
    assert(await page.evaluate(() => window.__TRICKS_TEST_BLINK_TIMERS__()) === 0, '大会変更でタイマー解除')
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.clock.fastForward(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, 'Canvas常時描画なし')
    return {passed:'four independent cell blinks, 1800ms boundary, 333ms cycle, rank-only whole blink, no nested blink, repeated change deadline, event cleanup, canvas idle',metrics:after}
}
