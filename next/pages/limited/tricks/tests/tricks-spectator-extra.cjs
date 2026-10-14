async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    await page.setViewportSize({width: 1280, height: 900})
    await page.unrouteAll()
    let rankings = []
    let authenticated = false
    const player = {name: 'extra_test_player', draw_points: 5, rank_points: 1, card_count: 1, take_count: 1, hand_limit: 6}
    let state = {tournament: {event_id: 990402, title: '観戦追加検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', players: [player], me: null, field: [], hand: [], logs: [], deck_count: 20}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        const json = path === '/api/auth/session' ? (authenticated ? {user: {userId: 'extra_test_nonparticipant', role: 0}, expires: '2099-01-01'} : {})
            : path === '/api/users' ? [{userId: player.name, name: '追加テスト参加者'}]
            : path.endsWith('/state') ? state : path.endsWith('/scores') ? rankings : {}
        await route.fulfill({json})
    })
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('[data-tricks-access-message]').waitFor()
    await page.locator('[data-tricks-spectator-toggle]').click()
    assert(await page.locator('[data-tricks-access-message]').count() === 0, 'ログアウト観戦開始')
    assert(await page.locator('a[aria-label="ナレッジ"] svg').getAttribute('data-icon') === 'book-bookmark', 'ナレッジアイコン保持')
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.locator('[data-tricks-access-message]').waitFor()
    authenticated = true
    await page.reload()
    await page.locator('[data-tricks-access-message]').waitFor()
    await page.locator('[data-tricks-spectator-toggle]').click()
    assert(await page.locator('[data-tricks-access-message]').count() === 0, 'ログイン済み未参加観戦開始')
    // Real polling, independent of virtual-clock tests.
    state = {...state, players: [{...player, draw_points: 6}]}
    await page.locator('[data-tricks-stat-blink="dp"]').waitFor()
    await page.locator('[data-tricks-stat-blink]').waitFor({state: 'detached'})
    state = {...state, logs: [{id: 1, event: 'record_posted', actor_name: player.name, event_card_id: 1205, card_id: 205, stage_id: 7405, card_title: '回収済み切り札', rule_name: 'テストルール', score: 50, created_at: '2026-10-07T00:01:00Z'}]}
    await page.locator('[data-tricks-spectator-presentation="1"]').waitFor()
    assert((await page.locator('.tricks-field-detail-panel').innerText()).includes('回収済み切り札'), '取得前回収のタイトル復元')
    assert((await page.locator('[data-tricks-highlighted-post="1"]').innerText()).includes('50点'), '取得前回収の点数表示')
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.locator('[data-tricks-spectator-toggle]').click()
    rankings = Array.from({length: 12}, (_, index) => ({post_id: index + 1, post_rank: index + 1,
        user_id: index === 11 ? player.name : `extra_dummy_${index}`, score: index === 11 ? 0 : 100 - index,
        rule: 1, stage_id: 7405, rps: 0, created_at: '2026-10-07T12:00:00+09:00'}))
    state = {...state, logs: [{...state.logs[0], id: 2, score: 0}, ...state.logs]}
    await page.locator('[data-tricks-highlighted-post="2"] .score-type').waitFor()
    assert(await page.locator('[data-tricks-highlighted-post="2"] .score-type').innerText() === '0', '0点スコア表示')
    const visible = await page.locator('[data-tricks-highlighted-post="2"]').evaluate(el => {
        const rect = el.getBoundingClientRect()
        const parent = el.parentElement.parentElement.getBoundingClientRect()
        return rect.top >= parent.top && rect.bottom <= parent.bottom
    })
    assert(visible, '下位投稿へのスクロール')
    await page.setViewportSize({width: 390, height: 844})
    await page.locator('[data-tricks-spectator-toggle]').scrollIntoViewIfNeeded()
    const bounds = await page.locator('[data-tricks-spectator-toggle]').boundingBox()
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'スマホで観戦ボタン到達')
    const panel = await page.locator('.tricks-field-detail-panel').boundingBox()
    assert(panel.x >= 0 && panel.x + panel.width <= 390, 'スマホでパネル幅')
    await page.screenshot({path: 'output/playwright/tricks-spectator-mobile-panel.png'})
    await page.locator('[data-tricks-spectator-toggle]').click()
    assert(await page.locator('[data-tricks-spectator-presentation]').count() === 0, 'スマホで観戦解除')
    await page.goto('about:blank')
    return {passed: 'guest, nonparticipant, knowledge icon, real polling, tooltip numeric change, collected post, zero score, lower ranking scroll, mobile button/panel, unmount'}
}
