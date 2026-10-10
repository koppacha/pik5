async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const base = new Date('2026-10-10T12:00:00+09:00')
    await page.clock.install({time: base})
    await page.clock.resume()
    let event = {event_id: 261009, title: '第19回期間限定ランキング', rule_name: 'トリックテイキング制×スタンダード', participant_count: 14, state: 'scheduled', start_at: '2026-10-09T20:00:00+09:00', end_at: '2026-10-11T19:59:00+09:00'}
    let game = false
    const tournamentRequests = []
    const players = Array.from({length: 25}, (_, i) => ({name: `scroll_dummy_${i}`, total_rank_points: 25 - i, draw_points: 20, card_count: 0, hand_limit: 6}))
    const state = {tournament: {...event, available: true, debug: true}, debug_state: {frozen: true}, server_now: base.toISOString(), me: players[0], players, field: [], hand: [], deck_count: 40, logs: []}
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url())
        const path = url.pathname
        let json = {data: []}
        if (path === '/api/auth/session') json = game ? {user: {userId: players[0].name, role: 0}, expires: '2099-01-01'} : {}
        else if (path === '/api/users') json = players.map(p => ({userId: p.name, name: p.name}))
        else if (path.endsWith('/tricks/tournament')) {
            tournamentRequests.push(url.search)
            json = event
        } else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.endsWith('/scores') || path.endsWith('/collected')) json = []
        else if (path.endsWith('/discord/events')) json = {data: null}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/')
    const box = page.locator('[data-tricks-active-event]')
    await box.waitFor()
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100))
    assert((await box.innerText()).includes('19:59'), '終了日時はAPIの19:59')
    assert((await box.innerText()).includes('参加者数：14人'), '現在大会の参加者数')
    assert(tournamentRequests.every(query => !query.includes('event_id')), '固定テスト大会IDを送らない')
    assert(await box.getByRole('link', {name: '大会会場へ/Enter'}).getAttribute('href') === '/limited/trick', '大会会場導線')
    await page.screenshot({path: 'output/playwright/tricks-home-active-fixed.png'})
    event = {...event, event_id: 291111, participant_count: 17, end_at: '2026-10-12T20:01:00+09:00'}
    await page.clock.runFor(31000)
    await box.getByText('参加者数：17人', {exact: true}).waitFor()
    assert((await box.innerText()).includes('20:01'), '次の大会のAPI日時へ追従')

    const current = await page.evaluate(() => Date.now())
    event = {...event, start_at: new Date(current + 60000).toISOString(), end_at: new Date(current + 63000).toISOString()}
    await page.clock.resume()
    await page.reload()
    await page.getByText('次のイベント', {exact: true}).waitFor()
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100))
    assert(await box.count() === 0, '開始前は通常ボックス')
    const untilStart = new Date(event.start_at).getTime() - await page.evaluate(() => Date.now())
    await page.clock.runFor(untilStart - 1)
    assert(await box.count() === 0, '開始1ms前は非表示')
    await page.clock.runFor(1)
    await box.waitFor()
    await page.clock.runFor(2999)
    assert(await box.count() === 1, '終了1ms前は表示')
    await page.clock.runFor(1)
    await page.getByText('次のイベント', {exact: true}).waitFor()
    assert(await box.count() === 0, '終了境界で通常ボックスへ戻る')

    game = true
    await page.clock.resume()
    await page.goto('http://localhost:3005/limited/tricks')
    await page.locator('[data-tricks-player]').first().waitFor()
    const scroll = page.locator('[data-tricks-header-scroll]')
    const styles = await scroll.evaluate(el => ({width: el.clientWidth, content: el.scrollWidth, overflow: getComputedStyle(el).overflowX, scrollbar: getComputedStyle(el).scrollbarWidth, webkit: getComputedStyle(el, '::-webkit-scrollbar').display}))
    assert(styles.content > styles.width && styles.overflow === 'auto', '多数参加者の横スクロールを維持')
    assert(styles.scrollbar === 'none' && styles.webkit === 'none', '標準とWebKitのスクロールバー非表示')
    await scroll.hover()
    await page.mouse.wheel(500, 0)
    await page.waitForTimeout(400)
    assert(await scroll.evaluate(el => el.scrollLeft > 0), '横ホイールでスクロールできる')
    await page.screenshot({path: 'output/playwright/tricks-player-scrollbar-hidden.png'})
    await page.locator('[data-tricks-spectator-toggle]').click()
    assert(await scroll.evaluate(el => getComputedStyle(el).overflowX === 'visible'), '観戦モードは折り返し表示を維持')
    const rows = await page.locator('[data-tricks-player]').evaluateAll(els => new Set(els.map(el => Math.round(el.getBoundingClientRect().top))).size)
    assert(rows > 1, '観戦モードは2行目以降に表示')
    await page.waitForTimeout(1000)
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping === true)
    const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
    assert(after.phaserRenderCount === before.phaserRenderCount && after.phaserLoopSleeping, '静止時Canvas描画ループなし')
    assert(after.domNodes === before.domNodes && after.canvasCount === before.canvasCount, 'DOMとCanvas増殖なし')
    assert(Number(after.activeRaf || 0) === 0 && Number(after.activeTimers || 0) === 0, '描画RAF・タイマーなし')
    await page.goto('about:blank')
    assert(await page.locator('canvas').count() === 0, '画面離脱でCanvas破棄')
    return {passed: 'current event + API dates + next event + start/end boundaries, hidden scrollbar + horizontal wheel + spectator wrap, canvas idle/cleanup', styles, tournamentRequests, before, after}
}
