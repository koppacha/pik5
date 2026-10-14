async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const players = Array.from({length: 3}, (_, i) => ({name: `mini_layout_${i}`, total_rank_points: 3 - i, draw_points: 5, card_count: 0, hand_limit: 6, take_count: 0}))
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: 'ミニカード配置検証', rule_name: '合成ルール', text: '合成データのみ', rarity: 1, difficulty: 1, stack_count: 3, creator: '架空作者', taker: players[0].name, limit_at: '2099-01-01T00:00:00+09:00'}
    const state = {tournament: {event_id: 990411, title: 'ミニカード配置検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00'}, me: players[0], players, field: [card], hand: [], deck_count: 20, logs: [], holder_cards: []}
    const setMiniCards = count => { state.holder_cards = Array.from({length: count}, (_, i) => ({...card, stage_id: 8000 + i, player_name: players[0].name})) }
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: players[0].name, role: 0}, expires: '2099-01-01'}
        else if (path === '/api/users') json = players.map(player => ({userId: player.name, name: player.name}))
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = []
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    setMiniCards(30)
    await page.setViewportSize({width: 1440, height: 1100})
    await page.goto('http://localhost:3005/limited/trick')
    const geometry = async () => page.evaluate(() => {
        const mini = document.querySelector('[data-tricks-mini-holder-cards]')
        const field = document.querySelector('.tricks-dom-card-field')
        const header = document.querySelector('[data-tricks-header-scroll]')
        return {rows: new Set([...mini.children].map(el => Math.round(el.getBoundingClientRect().top))).size, miniBottom: mini.getBoundingClientRect().bottom, headerBottom: header.getBoundingClientRect().bottom, fieldTop: field.getBoundingClientRect().top}
    })
    const verify = async (count, label) => {
        await page.waitForFunction(n => document.querySelector('[data-tricks-mini-holder-cards]')?.children.length === n, count)
        await page.waitForFunction(() => {
            const header = document.querySelector('[data-tricks-header-scroll]')
            const field = document.querySelector('.tricks-dom-card-field')
            return header && field && field.getBoundingClientRect().top >= header.getBoundingClientRect().bottom + 15
        })
        const bounds = await geometry()
        assert(bounds.rows >= 3 && bounds.fieldTop >= bounds.miniBottom + 15, `${label}: ３行以上でも切り札と重ならない`)
        return bounds
    }
    const first = await verify(30, '通常モード')
    setMiniCards(65)
    const grown = await verify(65, '枚数増加')
    assert(grown.fieldTop > first.fieldTop, '枚数増加で切り札が下がる')
    await page.getByRole('button', {name: '手札非表示', exact: true}).click()
    await verify(65, '手札非表示')
    await page.getByRole('button', {name: '観戦モード', exact: true}).click()
    await page.setViewportSize({width: 1024, height: 1100})
    await verify(65, '観戦・幅1024')
    await page.screenshot({path: 'output/playwright/tricks-mini-card-layout.png'})
    await page.getByRole('button', {name: '観戦モード', exact: true}).click()
    await verify(65, '観戦解除')
    setMiniCards(30)
    const shrunk = await verify(30, '枚数減少')
    assert(shrunk.fieldTop < grown.fieldTop, '枚数減少で開始位置が復帰')
    await page.waitForTimeout(1000)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(5000)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping && after.activeRaf === 0, '静止時の描画ループ停止')
    return {passed: 'ミニカード３行以上・増減・通常/手札非表示/観戦・画面幅変更・描画負荷', first, grown, shrunk, metrics: after}
}
