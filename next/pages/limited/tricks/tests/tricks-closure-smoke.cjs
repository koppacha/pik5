async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const users = [{userId: 'closure_test', name: '閉幕検証'}]
    const card = {id: 801, event_card_id: 801, stage_id: 1803, post_count: 2, title: '閉幕検証カード', rule_name: '合成ルール', text: '検証専用', rarity: 1, difficulty: 1, creator: 'closure_test', taker: 'closure_test', taken_at: '2026-10-09T20:00:00+09:00', collected_at: '2026-10-11T19:59:00+09:00', stack_count: 3, holders: ['closure_test'], total_reward_points: 24, my_can_post: true, my_initial_post_cost: 0, my_has_record: true, rankings: [{user_id: 'closure_test', score: 123, rank: 1, post_rank: 1, provisional_reward_points: 24}]}
    const cards = [{...card, id: 802, event_card_id: 802, stage_id: 1802}, {...card, id: 803, event_card_id: 803, stage_id: 1804, post_count: 0, holders: [], total_reward_points: 0}, card]
    const state = {tournament: {event_id: 261009, title: '第19回期間限定ランキング', state: 'ended', available: false, end_at: '2026-10-11T19:59:00+09:00', debug: false}, server_now: '2026-10-11T20:00:00+09:00', me: null, players: [], hand: [], field: [], holder_cards: [], deck_count: 0, logs: []}
    let stateReads = 0
    await page.unroute('**/api/**')
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = null
        else if (path === '/api/users') json = users
        else if (path === '/api/server/tricks/state') { json = state; stateReads += 1 }
        else if (path === '/api/server/tricks/collected') json = cards
        else if (path.includes('/logs')) json = []
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(json)})
    })
    await page.goto('http://localhost:3005/limited/tricks')
    const results = page.getByTestId('tricks-collected-results')
    await results.waitFor()
    const ids = await results.locator('[data-tricks-card-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tricks-card-id')))
    assert(JSON.stringify(ids) === JSON.stringify(['802', '801', '803']), '投稿数降順・ステージID昇順・ホルダーなしも表示')
    assert(await results.locator('[data-tricks-posted], [data-tricks-free]').count() === 0, '閉幕後投稿マークなし')
    assert((await results.locator('.tricks-dom-stack-value').allTextContents()).join(',') === '24,24,0', 'ポット込み実還元')
    await results.locator('[data-tricks-card-id="801"]').click()
    assert(await page.getByText('回収時の総還元 24P', {exact: false}).count() > 0, '詳細実還元')
    assert(await page.getByRole('button', {name: /記録を投稿|無料で投稿|投稿する/}).count() === 0, '投稿導線なし')
    assert(await page.locator('canvas').count() > 0, 'Phaser canvasあり')
    assert(await page.locator('[data-tricks-access-backdrop]').count() === 0, '閉幕後の参加ゲートなし')
    await page.waitForTimeout(4500)
    const before = stateReads
    await page.waitForTimeout(6500)
    assert(stateReads === before, `閉幕後stateポーリング停止 ${before} -> ${stateReads}`)
    await page.setViewportSize({width: 390, height: 844})
    assert(await results.isVisible(), 'スマホ結果一覧表示')
    await page.setViewportSize({width: 1440, height: 1000})
    await page.screenshot({path: 'next/pages/limited/tricks/output/playwright/tricks-closure.png'})
    return {checks: 9, cardOrder: ids, stateReads, canvasCount: await page.locator('canvas').count()}
}
