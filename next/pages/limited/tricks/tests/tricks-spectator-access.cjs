async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    await page.unrouteAll()
    await page.setViewportSize({width: 1280, height: 900})
    let authenticated = false
    const player = {name: 'access_test_player', draw_points: 10, total_rank_points: 2, card_count: 1, hand_limit: 6, take_cost: 2}
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '操作無効確認切り札', rule_name: 'テストルール', rarity: 1, difficulty: 1, limit_at: '2099-01-01T00:00:00+09:00', my_can_extend: true, my_can_post: true}
    let state = {tournament: {event_id: 990403, title: '観戦導線検証', available: true, state: 'active', debug: true, end_at: '2099-01-01T00:00:00+09:00'}, debug_state: {frozen: true}, server_now: '2026-10-07T12:00:00+09:00', me: null, players: [player], field: [card], hand: [], logs: [], deck_count: 20}
    let writes = []
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (route.request().method() === 'POST') {
            writes.push(path)
            if (path.endsWith('/join')) { state = {...state, me: player}; json = {player} }
        } else if (path === '/api/auth/session') json = authenticated ? {user: {userId: player.name, role: 10}, expires: '2099-01-01'} : {}
        else if (path === '/api/users') json = [{userId: player.name, name: '導線テスト参加者'}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = []
        await route.fulfill({json})
    })
    await page.goto('http://localhost:3005/limited/trick')
    const gate = page.locator('[data-tricks-access-message]')
    await gate.waitFor()
    assert(await gate.getByRole('link', {name: 'ログインする'}).count() === 1, 'ログイン案内')
    await page.screenshot({path: 'output/playwright/tricks-spectator-entry.png'})
    await gate.getByRole('button', {name: '観戦する'}).click()
    await page.locator('[data-tricks-info-login]').waitFor()
    await page.screenshot({path: 'output/playwright/tricks-spectator-guest.png'})
    assert(await gate.count() === 0, 'ゲスト観戦開始')
    assert(await page.locator('[data-tricks-info-login]').getAttribute('href') === '/auth/login', 'イベント情報ログイン導線')
    await page.locator('[data-tricks-spectator-toggle]').click()
    await gate.waitFor()
    assert(await gate.getByRole('link', {name: 'ログインする'}).count() === 1, 'ゲスト解除の戻り先')
    authenticated = true
    await page.reload()
    await gate.waitFor()
    assert(await gate.getByRole('button', {name: '参加する'}).count() === 1, '未参加の参加案内')
    await gate.getByRole('button', {name: '観戦する'}).click()
    await page.locator('[data-tricks-info-join]').waitFor()
    await page.locator('[data-tricks-spectator-toggle]').click()
    await gate.waitFor()
    assert(await gate.getByRole('button', {name: '参加する'}).count() === 1, '未参加解除の戻り先')
    await gate.getByRole('button', {name: '観戦する'}).click()
    await page.locator('[data-tricks-info-join]').click()
    await page.getByRole('dialog', {name: '遊び方'}).waitFor()
    assert(await page.locator('[data-tricks-spectator-toggle]').getAttribute('aria-pressed') === 'false', '参加で観戦解除')
    assert(writes.filter(path => path.endsWith('/join')).length === 1, '参加操作は一度')
    await page.getByRole('dialog', {name: '遊び方'}).getByRole('button', {name: '閉じる', exact: true}).click()
    await page.locator('[data-tricks-spectator-toggle]').click()
    assert(await page.locator('[data-tricks-info-access]').count() === 0, '参加済み観戦では参加導線なし')
    const before = writes.length
    await page.locator('.tricks-dom-card-field').click()
    await page.locator('[data-tricks-post-button]').waitFor()
    assert(await page.locator('[data-tricks-post-button]').isEnabled(), '観戦の投稿は終了確認用に活性')
    assert(await page.locator('[data-tricks-extend-button]').isDisabled(), '観戦の延長非活性')
    assert(await page.getByRole('button', {name: '即時回収'}).isDisabled(), '観戦の回収非活性')
    assert(await page.locator('.tricks-command-toggle').getAttribute('aria-expanded') === 'false' && await page.locator('.tricks-dom-deck').getAttribute('aria-hidden') === 'true', 'コマンド収納・ドロー操作なし')
    await page.locator('.tricks-field-detail-panel').getByRole('button', {name: '閉じる', exact: true}).click()
    await page.getByRole('button', {name: 'DEBUG', exact: true}).click()
    const debug = page.getByTestId('tricks-debug-panel')
    await debug.getByRole('button', {name: '固定', exact: true}).waitFor()
    for (const name of ['固定', '+1分', '+30分', '+90分', '+1時間', '実時刻へ戻す']) {
        assert(await debug.getByRole('button', {name, exact: true}).isDisabled(), `観戦のデバッグ無効 ${name}`)
    }
    await page.waitForTimeout(3300)
    assert(writes.length === before, '観戦中にゲーム更新POSTなし')
    await debug.getByRole('button', {name: 'デバッグを閉じる'}).click()
    await page.screenshot({path: 'output/playwright/tricks-spectator-access.png'})
    await page.goto('about:blank')
    return {passed: 'guest/nonparticipant watch entry, info login/join, exit gate, join transition, post exit confirmation enabled, disabled extend/collect/debug, no game POST while spectating'}
}
