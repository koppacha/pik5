async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    await page.unrouteAll()
    const players = Array.from({length: 22}, (_, index) => ({name: `info_test_${String(index + 1).padStart(2, '0')}`, total_rank_points: 100 - index, draw_points: 8, card_count: 3, hand_limit: 12, take_level: 2, take_count: 4, take_cost: 4, balance_tax_threshold: 20, collected_card_count: 2, subsidy_flag: index === 0, balance_tax_eligible: index === 1}))
    let loggedInUser = players[1].name
    const state = {tournament: {event_id: 990407, title: 'ユーザー情報検証', participant_count: players.length, available: true, state: 'active', end_at: '2099-01-01T00:00:00+09:00'}, debug_state: {frozen: true}, server_now: '2026-10-08T12:00:00+09:00', me: players[1], players, hand: [], field: [], logs: [], deck_count: 17}
    await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        let json = {}
        if (path === '/api/auth/session') json = {user: {userId: loggedInUser, role: 0}, expires: '2099-01-01'}
        else if (path === '/api/users') json = players.map((player, index) => ({userId: player.name, name: `表示テスト${index + 1}`}))
        else if (path.endsWith('/state')) json = state
        else if (path.endsWith('/holders')) json = {historical_counts: {[players[0].name]: 5, [players[1].name]: 8}}
        else if (path.endsWith('/collected')) json = []
        await route.fulfill({json})
    })
    await page.setViewportSize({width: 1440, height: 1000})
    await page.goto('http://localhost:3005/limited/trick')
    await page.waitForFunction(() => document.querySelectorAll('[data-tricks-player]').length === 22)
    const info = page.locator(`[data-tricks-player="${players[1].name}"]`)
    const verifyBorders = async () => {
        const results = await page.locator('[data-tricks-player]').evaluateAll(els => els.map(el => {
            const rank = Number(el.dataset.tricksPlayerRank)
            const key = rank <= 3 ? String(rank) : rank <= 10 ? '4to10' : rank <= 20 ? '11to20' : '21plus'
            const css = getComputedStyle(el)
            return {rank, left: css.borderLeftWidth, top: css.borderTopWidth, right: css.borderRightWidth, bottom: css.borderBottomWidth, color: css.borderLeftColor, expected: css.getPropertyValue(`--color-rank-${key}-border`).trim(), shadow: css.boxShadow}
        }))
        const toRgb = hex => `rgb(${[1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`
        assert(results.every(r => r.left === '5px' && r.top === '1px' && r.right === '1px' && r.bottom === '1px'), '左だけ5px')
        assert(results.every(r => r.color === toRgb(r.expected)), '1〜22位を通常ランキング色に合わせる')
        assert(results.every(r => r.shadow === 'none'), 'ログインユーザーによる枠強調なし')
        return results
    }
    const borders = await verifyBorders()
    const labels = await info.locator('[data-tricks-player-metrics] > div').evaluateAll(els => els.map(el => el.firstElementChild.textContent))
    assert(labels.join(',') === 'ランク,DP,手札,回収', '4列の指定名・順番')
    const values = await info.locator('[data-tricks-player-metrics] strong').allTextContents()
    assert(values.join(',') === '99,8,3,2', '4項目の数値')
    const geometry = await info.locator('[data-tricks-player-metrics] > div').evaluateAll(els => els.map(el => ({y:el.getBoundingClientRect().y, width:el.clientWidth, labelWidth:el.firstElementChild.scrollWidth, contentWidth:el.firstElementChild.clientWidth})))
    assert(geometry.every(r => r.y === geometry[0].y && r.labelWidth <= r.contentWidth), '同一行で項目名が収まる')
    assert(await info.evaluate(el => el.lastElementChild.hasAttribute('data-tricks-player-metrics')), '最下部にグリッド')
    const row = await info.locator('[data-tricks-player-name-row]').boundingBox()
    const name = await info.locator('[data-tricks-player-screen-name]').boundingBox()
    const level = await info.locator('[data-tricks-take-level]').boundingBox()
    assert(level.x > name.x && Math.abs(level.x + level.width - row.x - row.width) < 1 && Math.abs(level.y - name.y) < 5, '名前とレベルが同じ行の右端')
    const blockText = await info.innerText()
    assert(!blockText.includes('累計') && !blockText.includes('ホルダー') && !blockText.includes('12') && !blockText.includes('RP'), '旧名・累計・手札上限を情報ブロックから除外')
    await info.click()
    const tooltip = page.locator('[data-tricks-player-tooltip]')
    await tooltip.waitFor()
    assert((await tooltip.innerText()).includes('累計所持カード：10 枚'), '累計は過去8枚＋今回2枚')
    assert((await tooltip.innerText()).includes('手札の上限 12枚'), '手札上限はツールチップ')
    assert((await tooltip.innerText()).includes('税金徴収ボーダー 21DP以上'), '既存の税金ボーダー維持')
    await page.screenshot({path:'output/playwright/tricks-player-info-tooltip.png'})
    await page.mouse.click(1400, 600)
    await tooltip.waitFor({state:'detached'})
    assert(await info.locator('[data-tricks-balance-tax="active"]').count() === 1, '課税フラグ維持')
    const subsidy = page.locator(`[data-tricks-player="${players[0].name}"]`)
    assert(await subsidy.locator('[data-tricks-points-label]').evaluate(el => getComputedStyle(el).textDecorationLine) === 'underline', '給付DP下線維持')
    await page.getByRole('button',{name:'テーマ変更',exact:true}).click()
    await verifyBorders()
    await page.screenshot({path:'output/playwright/tricks-player-info-other-theme.png'})
    await page.getByRole('button',{name:'テーマ変更',exact:true}).click()
    loggedInUser = players[0].name
    state.me = players[0]
    await page.reload()
    await page.waitForFunction(() => document.querySelectorAll('[data-tricks-player]').length === 22)
    const afterLoginChange = await verifyBorders()
    assert(afterLoginChange.every((r,index) => r.color === borders[index].color), 'ログインユーザー変更でも枠色不変')
    await page.setViewportSize({width:390,height:844})
    const mobilePlayer = page.locator(`[data-tricks-player="${players[0].name}"]`)
    await mobilePlayer.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await mobilePlayer.click()
    await tooltip.waitFor()
    assert((await tooltip.innerText()).includes('累計所持カード：7 枚'), '累計は過去5枚＋今回2枚')
    const tipBox = await tooltip.boundingBox()
    assert(tipBox.x >= 0 && tipBox.x + tipBox.width <= 390, 'スマホでツールチップ画面内')
    await page.screenshot({path:'output/playwright/tricks-player-info-mobile.png'})
    await page.mouse.click(380,600)
    await page.waitForTimeout(2500)
    const before = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    await page.waitForTimeout(6500)
    const after = await page.evaluate(() => ({...window.__TRICKS_RENDER_METRICS__}))
    assert(before.phaserRenderCount === after.phaserRenderCount && after.phaserLoopSleeping, 'Canvas静止')
    return {passed:'rank border 1-22 and left5px, login-independent colors, name/level row, four metrics, tooltip-only lifetime/limit, subsidy/tax preservation, both themes/mobile, canvas idle', metrics:after}
}
