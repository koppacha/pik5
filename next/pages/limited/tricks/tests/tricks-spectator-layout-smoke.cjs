async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const players = Array.from({length: 14}, (_, i) => ({name: `layout_${String(i).padStart(2, '0')}`, total_rank_points: i < 2 ? 20 : i === 2 ? 10 : 0, draw_points: 10, card_count: 0, hand_limit: 6, take_level: 0, take_count: 0, next_take_at: i === 0 ? '2099-01-01T12:00:00+09:00' : null}))
    const card = {id: 202, event_card_id: 1202, stage_id: 7402, title: '観戦配置検証', rule_name: '元ルール', text: '短いテスト本文', rarity: 1, difficulty: 1, stack_count: 3, creator: players[0].name, taker: players[0].name, limit_at: '2099-01-01T00:00:00+09:00', participant_count: 1}
    let authenticated = true
    const state = {tournament: {event_id: 990410, title: '観戦配置検証', participant_count: 14, state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true}, debug_state: {frozen: true}, server_now: '2026-10-09T12:00:00+09:00', me: players[0], players, hand: [], field: Array.from({length: 8}, (_, i) => ({...card, id: 202 + i, stage_id: 7402 + i})), deck_count: 69, logs: []}
    let writes = 0
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        if (route.request().method() === 'POST' && (path.endsWith('/draw') || path.endsWith('/post'))) writes++
        let json = {}
        if (path === '/api/auth/session') json = authenticated ? {user: {userId: players[0].name, role: 0}, expires: '2099-01-01T00:00:00.000Z'} : null
        else if (path === '/api/users') json = players.map(player => ({userId: player.name, name: '長いテイカー表示名を検証する参加者'}))
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/scores')) json = []
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.waitForFunction(() => document.querySelectorAll('[data-tricks-player]').length === 14)
    const ranks = await page.locator('[data-tricks-player]').evaluateAll(els => els.map(el => Number(el.dataset.tricksPlayerRank)))
    assert(ranks.slice(0, 4).join(',') === '1,1,3,4', '同率順位1,1,3,4')
    const heights = await page.locator('[data-tricks-player]').evaluateAll(els => els.map(el => el.getBoundingClientRect().height))
    assert(heights.every(h => h === heights[0]), '次回テイク有無で同じ高さ')
    const colors = await page.locator('[data-tricks-player]').evaluateAll(els => els.slice(0, 2).map(el => getComputedStyle(el).borderLeftColor))
    assert(colors[0] === colors[1], '同率の順位色一致')
    const taker = page.locator('.tricks-dom-card-field .tricks-dom-card-taker').first()
    assert((await taker.locator('span').innerText()).length <= 10, 'テイカー表示最大10文字')
    const icon = await taker.locator('svg').boundingBox()
    const takerBounds = await taker.boundingBox()
    assert(icon.x >= takerBounds.x && icon.x + icon.width <= takerBounds.x + takerBounds.width, 'テイカーアイコンが表示枠内')
    const command = page.locator('.tricks-command-window')
    const originalBottom = await command.evaluate(el => getComputedStyle(el).bottom)
    assert(originalBottom !== '0px', '通常コマンド位置')
    await page.getByRole('button', {name: '手札非表示', exact: true}).click()
    assert(await command.evaluate(el => getComputedStyle(el).bottom) === '0px', '手札非表示でコマンド最下部')
    assert(await page.locator('.tricks-field-viewport').evaluate(el => getComputedStyle(el).clipPath) === 'inset(174px 0px 0px)', '手札非表示で切り札領域が画面下端まで')
    await page.getByRole('button', {name: '手札を表示', exact: true}).click()
    assert(await command.evaluate(el => getComputedStyle(el).bottom) === originalBottom, '手札表示でコマンド位置復帰')
    const enter = async () => {
        await page.getByRole('button', {name: '観戦モード', exact: true}).click()
        await page.waitForTimeout(400)
    }
    const openCommand = async () => {
        const toggle = page.getByRole('button', {name: 'コマンド', exact: true})
        if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click()
        await page.waitForTimeout(300)
    }
    await enter()
    const geometry = await page.locator('[data-tricks-player]').evaluateAll(els => els.map(el => el.getBoundingClientRect().top))
    assert(new Set(geometry).size > 1, '観戦モードでユーザー情報を複数行表示')
    assert(await page.locator('[data-tricks-header-scroll]').evaluate(el => el.scrollWidth === el.clientWidth), '横スクロールなし')
    const verifyFieldTop = async () => {
        const header = await page.locator('[data-tricks-header-scroll]').boundingBox()
        const first = await page.locator('.tricks-dom-card-field').first().boundingBox()
        assert(Math.abs(first.y - (Math.ceil(header.y + header.height) + 16)) <= 1, '切り札はユーザー最下段の直下')
        const clip = await page.locator('.tricks-field-viewport').evaluate(el => getComputedStyle(el).clipPath)
        assert(clip.endsWith('0px 0px)'), '観戦モードで下端まで表示')
    }
    await verifyFieldTop()
    await page.setViewportSize({width: 1100, height: 1000})
    await page.waitForTimeout(300)
    await verifyFieldTop()
    await page.setViewportSize({width: 1440, height: 1000})
    await page.waitForTimeout(300)
    await openCommand()
    const exit = page.getByRole('button', {name: '観戦モードを終了', exact: true})
    assert(await exit.isEnabled(), '観戦終了ボタンが活性')
    await page.getByRole('button', {name: 'ドロー', exact: true}).click()
    await page.getByRole('dialog').waitFor()
    assert((await page.getByRole('dialog').innerText()).includes('観戦モードを終了しますか？'), 'ドロー時の終了確認')
    await page.getByRole('button', {name: 'キャンセル', exact: true}).click()
    assert(await page.getByRole('button', {name: '観戦モード', exact: true}).getAttribute('aria-pressed') === 'true', 'キャンセルは観戦継続')
    await page.getByRole('button', {name: 'ドロー', exact: true}).click()
    await page.getByRole('button', {name: '終了する', exact: true}).click()
    await page.waitForTimeout(300)
    assert(await page.getByRole('button', {name: '観戦モード', exact: true}).getAttribute('aria-pressed') === 'false', '終了選択で観戦OFF')
    assert(await command.evaluate(el => getComputedStyle(el).bottom) === originalBottom, '観戦解除でコマンド位置復帰')
    assert(writes === 0, '観戦ドロー確認では投稿APIを送らない')
    await enter()
    await page.locator('.tricks-dom-card-field').first().click()
    const post = page.locator('[data-tricks-post-button]')
    await post.waitFor()
    assert(await post.isEnabled(), '観戦中の投稿確認ボタン活性')
    await post.click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('button', {name: '終了する', exact: true}).click()
    await enter()
    await openCommand()
    await page.getByRole('button', {name: '観戦モードを終了', exact: true}).click()
    assert(await page.getByRole('button', {name: '観戦モード', exact: true}).getAttribute('aria-pressed') === 'false', '手札ボタンから観戦終了')
    authenticated = false
    state.me = null
    await page.reload()
    await page.locator('[data-tricks-start-spectating]').waitFor()
    await page.locator('[data-tricks-start-spectating]').click()
    await page.waitForTimeout(300)
    await openCommand()
    await page.getByRole('button', {name: 'ドロー', exact: true}).click()
    await page.getByRole('button', {name: '終了する', exact: true}).click()
    await page.locator('[data-tricks-start-spectating]').waitFor()
    assert((await page.locator('[data-tricks-start-spectating]').innerText()) === '観戦する', '未ログインは入場前へ復帰')
    await page.locator('[data-tricks-start-spectating]').click()
    await page.waitForTimeout(300)
    await page.screenshot({path: 'output/playwright/tricks-spectator-layout.png'})
    await page.locator('.tricks-dom-card-field').first().click()
    await page.locator('[data-tricks-post-button]').click()
    await page.getByRole('button', {name: '終了する', exact: true}).click()
    await page.locator('[data-tricks-start-spectating]').waitFor()
    state.players = players.slice(0, 2)
    state.tournament.participant_count = 2
    state.field = [card]
    await page.reload()
    await page.locator('[data-tricks-start-spectating]').click()
    await page.waitForTimeout(400)
    await verifyFieldTop()

    await page.locator('canvas').waitFor()
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping === true)
    await page.waitForTimeout(300)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(1200)
    const metrics = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(metrics.activeRaf === 0 && metrics.activeTimers === 0 && metrics.phaserLoopSleeping && metrics.phaserRenderCount === before.phaserRenderCount, `Canvas静止・タイマー残留なし ${JSON.stringify({before, metrics})}`)
    assert(writes === 0, '確認操作で書き込みAPIなし')
    return {passed: 'tie ranks, fixed cooldown height, taker icon, hidden-hand field/command, spectator wrap/resize, draw/post confirmation, exit button, guest entrance, canvas idle', metrics}
}
