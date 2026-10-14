async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let authenticated = true
    let role = 10
    let requests = 0
    const player = {name: 'stats_test', draw_points: 4, total_rank_points: 2, card_count: 1, hand_limit: 6, take_count: 1}
    const card = {id: 302, event_card_id: 1302, stage_id: 7502, title: '統計テストカード', rule_name: 'テストルール', text: '合成データ', rarity: 2, difficulty: 1, creator: 'creator_test', was_opened: true}
    const state = {tournament: {event_id: 990405, title: '統計検証', state: 'active', available: true, end_at: '2099-01-01T00:00:00+09:00', debug: true, participant_count: 1, pot_points: 5}, debug_state: {frozen: true}, server_now: '2026-10-08T12:00:00+09:00', me: player, players: [player], hand: [card], field: [{...card, taker: player.name, limit_at: '2099-01-01T00:00:00+09:00', stack_count: 5, live_total_reward: 5}], deck_count: 17, logs: [], draw_total: 12, take_total: 3, points_total: 29, post_total: 7, trash_count: 3, collected_count: 2}
    const stats = {users: [{user_id: player.name, total_rank_points: 2, draw_count: 12, earned_points: 21, spent_points: 17}], cards: [{event_card_id: 999, stage_id: null, title: '未テイクカード'}, {...card, field_seconds: 3900, post_count: 5, total_reward_points: 15, participants: [player.name], creator: 'creator_test', taker: player.name, holders: [player.name]}]}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = authenticated ? {user: {userId: player.name, role}, expires: '2099-01-01'} : {}
        else if (path === '/api/users') json = [{userId: player.name, name: 'テスト参加者'}, {userId: 'creator_test', name: 'テスト作者'}]
        else if (path.endsWith('/join')) { state.me = player; json = {player} }
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/admin-stats')) {
            requests += 1
            json = stats
        }
        else if (path.endsWith('/scores')) json = [{post_id: 1, post_rank: 1, user_id: player.name, score: 123, rule: 1, post_comment: '1234567890追加コメント', stage_id: 7502, created_at: state.server_now}]
        else if (path.endsWith('/collected')) json = []
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.locator('canvas').waitFor()
    const info = page.locator('[data-tricks-tournament-info]')
    await page.locator('[data-tricks-post-total]').filter({hasText: '7件'}).waitFor()
    const summary = page.locator('[data-tricks-info-summary]')
    const cells = page.locator('[data-tricks-info-metrics] > div')
    assert(await info.getByText('大会情報', {exact: true}).count() === 0, '見出しを削除')
    assert(await page.locator('.tricks-top-bar [data-tricks-debug-toggle]').count() === 1, 'DEBUGはヘッダー')
    assert(await info.getByRole('button', {name:'DEBUG'}).count() === 0, '情報内のDEBUGなし')
    const outer = await info.evaluate(el => ({bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopWidth}))
    assert(outer.bg === 'rgba(0, 0, 0, 0)' && outer.border === '0px', '外枠背景なし')
    assert(await cells.count() === 8, 'ポットあり8項目')
    const labels = await cells.evaluateAll(els => els.map(el => el.firstElementChild.textContent))
    assert(labels.join(',') === 'デッキ,ドロー,投稿,回収,捨て札,テイク,合計P,ポット', '4列の指定順')
    const boxes = await cells.evaluateAll(els => els.map(el => ({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,border:getComputedStyle(el).borderTopWidth,bg:getComputedStyle(el).backgroundColor})))
    assert(boxes[0].y === boxes[3].y && boxes[4].y === boxes[7].y && boxes[4].y > boxes[0].y, '4列2段')
    assert(boxes.every(b => b.border === '1px' && b.bg !== 'rgba(0, 0, 0, 0)'), '下部セル枠と背景')
    const heads = await summary.locator(':scope > div').evaluateAll(els => els.map(el => ({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,width:el.getBoundingClientRect().width})))
    assert(heads.length === 3 && heads[0].y === heads[1].y && heads[2].y > heads[0].y && heads[2].width > heads[0].width, '上部2列と残り全幅')
    await page.screenshot({path:'output/playwright/tricks-additional-info.png'})
    await info.click()
    const panel = page.locator('[data-tricks-admin-stats]')
    await panel.waitFor()
    const active = await panel.getByRole('tab', {selected:true}).evaluate(el => ({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,radius:getComputedStyle(el).borderRadius}))
    assert(active.bg === 'rgb(33, 33, 33)' && active.color === 'rgb(225, 225, 225)' && active.radius === '8px', 'アクティブタブ背景文字と角丸')
    await page.screenshot({path:'output/playwright/tricks-additional-tabs.png'})
    await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'テーマ変更',exact:true}).click()
    await info.click()
    await panel.waitFor()
    const otherTheme = await panel.getByRole('tab',{selected:true}).evaluate(el => ({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}))
    assert(otherTheme.bg === 'rgb(33, 33, 33)' && otherTheme.color === 'rgb(225, 225, 225)', '両テーマでタブ可読')
    await page.keyboard.press('Escape')
    await page.getByRole('button',{name:'テーマ変更',exact:true}).click()
    const deck = page.locator('.tricks-dom-deck')
    const hand = page.locator('.tricks-dom-card-hand')
    const command = page.locator('.tricks-command-window')
    const beforeDeck = await deck.boundingBox()
    const beforeHand = await hand.boundingBox()
    await deck.evaluate(el => { el.dataset.animationProbe = 'deck' })
    await hand.evaluate(el => { el.dataset.animationProbe = 'hand' })
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.waitForTimeout(60)
    const middle = await deck.boundingBox()
    assert(middle.y > beforeDeck.y && middle.y < beforeDeck.y + 1000, 'デッキスライド途中')
    await page.waitForTimeout(300)
    const afterDeck = await deck.boundingBox()
    const afterHand = await hand.boundingBox()
    const afterCommand = await command.boundingBox()
    assert(afterDeck.y >= 1000 && afterHand.y >= 1000, 'デッキ手札は画面外')
    assert(await deck.getAttribute('data-animation-probe') === 'deck' && await hand.getAttribute('data-animation-probe') === 'hand', '破棄せず移動')
    assert(afterCommand.x < 0 && Math.abs(afterCommand.x + afterCommand.width - 44) < 1, '左に収納しタブを残す')
    await command.locator('.tricks-command-toggle').click()
    assert(await command.getByRole('button', {name:'ドロー',exact:true}).isEnabled() && await command.getByRole('button', {name:'観戦モードを終了',exact:true}).isEnabled(), '観戦中はドローの終了確認と観戦終了操作を有効化')
    await command.locator('.tricks-command-toggle').click()
    await page.waitForTimeout(300)
    await page.screenshot({path:'output/playwright/tricks-additional-spectator.png'})
    await page.locator('[data-tricks-spectator-toggle]').click()
    await page.waitForTimeout(300)
    assert(Math.abs((await deck.boundingBox()).y - beforeDeck.y) < 1 && Math.abs((await hand.boundingBox()).y - beforeHand.y) < 1, '解除で元の位置')
    assert(await command.locator('.tricks-command-toggle').getAttribute('aria-expanded') === 'true', 'コマンド元の状態')
    state.tournament.pot_points = 0
    await page.reload()
    await page.locator('[data-tricks-post-total]').filter({hasText:'7件'}).waitFor()
    assert(await page.locator('[data-tricks-pot]').count() === 0 && await cells.count() === 7, '0Pポットセルを除外')
    await page.waitForTimeout(2500)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, 'Canvas静止')
    authenticated = false
    state.me = null
    state.hand = []
    await page.reload()
    const gate = page.locator('[data-tricks-access-message]')
    await gate.waitFor()
    await gate.getByRole('button', {name:'観戦する'}).click()
    const login = page.locator('[data-tricks-info-login]')
    await login.waitFor()
    const checkCta = async (cta) => {
        const rect = await cta.boundingBox()
        assert(rect.x === 20 && Math.abs(rect.y + rect.height - (page.viewportSize().height - 20)) < 1 && rect.width >= 200 && rect.height >= 50, '左下固定の大きなボタン')
        assert((await cta.getAttribute('class')).includes('MuiButton-contained'), 'contained')
    }
    await checkCta(login)
    assert(await login.innerText() === 'ログインして参加' && await login.getAttribute('href') === '/auth/login', 'ログイン導線')
    await page.waitForTimeout(350)
    await page.screenshot({path:'output/playwright/tricks-additional-guest.png'})
    await page.setViewportSize({width:390,height:844})
    await checkCta(login)
    await page.screenshot({path:'output/playwright/tricks-additional-mobile.png'})
    await page.setViewportSize({width:1440,height:1000})
    authenticated = true
    await page.reload()
    await gate.waitFor()
    await gate.getByRole('button', {name:'観戦する'}).click()
    const join = page.locator('[data-tricks-info-join]')
    await join.waitFor()
    await checkCta(join)
    await join.click()
    await page.getByRole('dialog', {name:'遊び方'}).waitFor()
    assert(await page.locator('[data-tricks-spectator-toggle]').getAttribute('aria-pressed') === 'false', '参加で観戦解除')
    await page.getByRole('dialog', {name:'遊び方'}).getByRole('button', {name:'閉じる',exact:true}).click()
    return {passed:'grid labels/order/borders, pot omission, header debug, dark rounded tabs, command/deck/hand slide and restore, guest/nonparticipant contained CTA and join, canvas idle',metrics:after}
}
