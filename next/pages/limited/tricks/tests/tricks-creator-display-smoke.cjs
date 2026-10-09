async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let role = 10
    let requests = 0
    const player = {name: 'stats_test', draw_points: 4, total_rank_points: 2, card_count: 1, hand_limit: 6, take_count: 1}
    const card = {id: 302, event_card_id: 1302, stage_id: 7502, title: '統計テストカード', rule_name: 'テストルール', text: '合成データ', rarity: 2, difficulty: 1, creator: 'creator_test', was_opened: true}
    const state = {tournament: {event_id: 990405, title: '統計検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-08T12:00:00+09:00', me: player, players: [player], hand: [card], field: [], deck_count: 17, logs: [], draw_total: 12, take_total: 3, points_total: 29}
    state.field = [{...card, id: 303, event_card_id: 1303, stage_id: 7503, creator: '共同案 Alice / Bob', limit_at: '2099-01-01T00:00:00+09:00'}]
    state.deck_creator_counts = [{creator: '共同案 Alice / Bob', count: 7}, {creator: 'creator_test', count: 2}]
    const stats = {users: [{user_id: player.name, total_rank_points: 2, draw_count: 12, earned_points: 21, spent_points: 17}], cards: [{...card, field_seconds: 3900, post_count: 5, total_reward_points: 15, participants: [player.name], creator: 'creator_test', taker: player.name, holders: [player.name]}]}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: player.name, role}, expires: '2099-01-01'}
        else if (path === '/api/users') json = [{userId: player.name, name: 'テスト参加者'}, {userId: 'creator_test', name: '置換禁止'}, {userId: '共同案 Alice / Bob', name: '共同名置換禁止'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/admin-stats')) {
            requests += 1
            json = stats
        }
        else if (path.endsWith('/collected')) json = []
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    const hand = page.locator('.tricks-dom-card-hand')
    await hand.waitFor()
    assert((await hand.locator('.tricks-dom-card-footer').innerText()).includes('creator_test'), '手札の作者名をそのまま表示')
    const creator = await hand.locator('.tricks-dom-card-creator').boundingBox()
    const opened = await hand.locator('[data-tricks-opened]').boundingBox()
    assert(creator.x < opened.x && Math.abs(creator.y - opened.y) < 15, '作者は左下・開封済みは右下')
    const info = page.locator('[data-tricks-tournament-info]')
    assert((await info.innerText()).match(/ドロー\s*12回/), 'ドロー総数')
    assert((await info.innerText()).match(/テイク\s*3回/), 'テイク総数')
    assert((await info.innerText()).match(/合計P\s*29P/), 'ポイント総数')
    assert(requests === 0, '閉じている間は統計未取得')
    await info.click()
    const panel = page.locator('[data-tricks-admin-stats]')
    await panel.locator('[data-tricks-admin-stat="earned_points"]').waitFor()
    assert(await panel.locator('[data-tricks-admin-stat="earned_points"]').innerText() === '21', '獲得P総数')
    await panel.getByRole('tab', {name: 'カード別ステータス', exact: true}).click()
    assert((await panel.locator('[data-tricks-card-stats]').innerText()).includes('1:05'), '場に出ていた時間')
    assert((await panel.locator('[data-tricks-card-stats]').innerText()).includes('creator_test'), 'カードの作者名をそのまま表示')
    await panel.getByRole('tab', {name: 'カード別ステータス'}).click()
    assert(await panel.isVisible(), '領域内クリックで維持')
    await page.keyboard.press('Escape')
    await page.locator('.tricks-dom-deck').click()
    const tooltip = page.getByRole('tooltip', {name: 'デッキ情報'})
    await tooltip.waitFor()
    assert((await tooltip.locator('[data-tricks-deck-creators]').innerText()).includes('共同案 Alice / Bob：7枚'), '共同名の集計表示')
    assert((await tooltip.locator('[data-tricks-deck-creators]').innerText()).includes('creator_test：2枚'), 'IDと一致しても変換しない')
    await page.keyboard.press('Escape')
    const field = page.locator('.tricks-dom-card-field .tricks-dom-card-creator')
    assert(await field.getAttribute('title') === '共同案 Alice / Bob', '切り札共同名全文')
    assert((await field.innerText()).includes('共同案 Alice'), '切り札共同名')
    await page.waitForTimeout(1000)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(2500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, 'canvas静止')
    await page.screenshot({path: 'output/playwright/tricks-creator-display.png'})
    await page.goto('about:blank')
    assert(await page.locator('canvas').count() === 0, 'canvas破棄')
    return {passed: '手札・切り札・管理者一覧・デッキ内訳の直接表示、共同名、ID衝突、canvas静止・破棄'}
}
