async (page) => {
    await page.unrouteAll()
    const assert = (value, message) => { if (!value) throw new Error(message) }
    const origins = [300, 301, 315, 316, 330, 331]
    const player = {name: 'category_dummy', draw_points: 20, total_rank_points: 0, card_count: origins.length, hand_limit: 12}
    const cards = origins.map((origin, i) => ({id: 990800 + i, event_card_id: 990800 + i, card_key: String(161 + i), card_reference_key: `261009-${161 + i}`, stage_id: 1800 + i, origin_stage_id: origin, card_id: 990800 + i, card_key: String(161 + i), card_reference_key: `261009-${161 + i}`, title: `カテゴリ検証${origin}`, rule_name: '合成ルール', text: '合成データのみ', rarity: 1, difficulty: 1, stack_count: 1, creator: '架空作者', taker: player.name, limit_at: '2099-01-01T00:00:00+09:00'}))
    const state = {tournament: {event_id: 990498, title: 'カテゴリ表示検証', state: 'active', available: true, debug: true, end_at: '2099-01-01T00:00:00+09:00'}, debug_state: {frozen: true}, server_now: '2026-10-10T03:00:00+09:00', me: player, players: [player], field: cards, hand: cards.map(c => ({...c, id: c.id + 100})), deck_count: 20, logs: []}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: player.name, role: 0}, expires: '2099-01-01'}
        else if (path === '/api/users') json = [{userId: player.name, name: player.name}]
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/holders')) json = {historical_counts: {}}
        else if (path.endsWith('/scores') || path.endsWith('/collected')) json = []
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/tricks')
    await page.locator('.tricks-dom-card-field').first().waitFor()
    const checkCards = async () => {
        for (const type of ['field', 'hand']) {
            for (let i = 0; i < cards.length; i += 1) {
                const id = cards[i].id + (type === 'hand' ? 100 : 0)
                const card = page.locator(`.tricks-dom-card-${type}[data-tricks-card-id="${id}"]`)
                const badge = card.locator('[data-tricks-stage-category]')
                const expected = [null, 'あつめろ', 'あつめろ', 'たおせ', 'たおせ', null][i]
                if (!expected) {
                    assert(await badge.count() === 0, `${type} 元${origins[i]}は追加表示なし`)
                    continue
                }
                assert(await badge.textContent() === expected, `${type} 元${origins[i]}のカテゴリ表記`)
                const result = await badge.evaluate(el => {
                    const series = el.previousElementSibling
                    const properties = ['backgroundColor', 'color', 'borderRadius', 'fontSize', 'lineHeight', 'padding']
                    const a = getComputedStyle(series)
                    const b = getComputedStyle(el)
                    return {same: properties.every(key => a[key] === b[key]), series: series.dataset.tricksSeries, right: el.getBoundingClientRect().left >= series.getBoundingClientRect().right}
                })
                assert(result.same && result.series === '3' && result.right, `${type}シリーズ右隣で同じスタイル`)
            }
        }
    }
    await checkCards()
    for (let i = 0; i < cards.length; i += 1) {
        const hand = page.locator(`.tricks-dom-card-hand[data-tricks-card-id="${cards[i].id + 100}"]`)
        assert((await hand.innerText()).includes(`#${161 + i}`), '公開カードIDを表示')
    }
    await page.screenshot({path: 'output/playwright/tricks-replenished-card-ids.png'})
    await page.getByRole('button', {name: 'テーマ変更', exact: true}).click()
    await checkCards()
    await page.setViewportSize({width: 1024, height: 900})
    await page.waitForTimeout(400)
    await checkCards()
    const crowded = page.locator('.tricks-dom-card-field[data-tricks-card-id="990801"] .tricks-dom-card-meta')
    assert(await crowded.evaluate(el => {
        const [identity, rarity] = el.children
        return identity.getBoundingClientRect().right <= rarity.getBoundingClientRect().left
    }), '1024pxでもカテゴリとレア度表示が重ならない')
    const selectedHand = page.locator('.tricks-dom-card-hand[data-tricks-card-id="990901"]')
    await selectedHand.dispatchEvent('click')
    await page.locator('.tricks-dom-card-hand.is-selected').waitFor()
    await page.waitForTimeout(300)
    assert(await selectedHand.locator('[data-tricks-stage-category]').isVisible(), '選択した手札にもカテゴリ表示')
    assert(await selectedHand.locator('.tricks-dom-card-meta').evaluate(el => {
        const [identity, rarity] = el.children
        return identity.getBoundingClientRect().right <= rarity.getBoundingClientRect().left
    }), '長いカードIDの手札でもカテゴリとレア度が重ならない')
    await page.waitForFunction(() => window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping === true)
    await page.waitForTimeout(600)
    const before = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => window.__TRICKS_DEBUG_SNAPSHOT__())
    assert(after.stateFetchCount > before.stateFetchCount, 'ポーリング中に検証')
    assert(after.phaserRenderCount === before.phaserRenderCount && after.phaserLoopSleeping, '静止時Canvas再描画なし')
    assert(after.domCards === before.domCards && after.domNodes === before.domNodes && after.canvasCount === before.canvasCount, 'DOMとCanvasが増えない')
    assert(Number(after.activeRaf || 0) === 0 && Number(after.activeTimers || 0) === 0, '演出RAF・タイマーなし')
    await page.goto('about:blank')
    assert(await page.locator('canvas').count() === 0, '画面離脱でCanvas破棄')
    await page.goto('http://localhost:3005/keyword/tricks-manual')
    await page.getByText('同内容カードへの記録の投稿', {exact: true}).waitFor()
    assert((await page.locator('[data-tricks-manual]').innerText()).includes('どれか１枚にしか投稿できません'), '記録の使い回し禁止を公開マニュアルに表示')
    return {passed: '301/315/316/330, outside 300/331, hand/field, same badge style, themes, 1024px, polling + canvas idle + cleanup', before, after}
}
