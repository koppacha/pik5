async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    let snapshotReads = 0
    let writes = 0
    let liveReads = 0
    let scoreReads = 0
    const listener = request => {
        const path = new URL(request.url()).pathname
        if (path.includes('/tricks/replay/') && path.endsWith('/snapshot')) snapshotReads += 1
        if (path === '/api/server/tricks/state') liveReads += 1
        if (path.startsWith('/api/server/tricks/') && !['GET','HEAD'].includes(request.method())) writes += 1
        if (/\/tricks\/cards\/\d+\/scores/.test(path)) scoreReads += 1
    }
    const json = async (url) => { const body = await (await page.request.get(url)).json(); return body.data ?? body }
    await page.unrouteAll()
    await page.goto('http://localhost:3005/limited/tricks')
    await page.getByRole('button', {name: 'リプレイモード', exact: true}).click()
    await page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    const manifest = await json('http://localhost:3005/api/server/tricks/replay/261009')
    assert(manifest.checkpoints.length === 193, '193 checkpoints')
    const slider = page.getByRole('slider', {name: 'リプレイ時点'})
    page.on('request', listener)
    const box = await slider.boundingBox()
    const before = await page.locator('.tricks-live-clock').textContent()
    await page.mouse.move(box.x + 8, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.26, box.y + box.height / 2, {steps: 8})
    await page.waitForTimeout(250)
    assert(snapshotReads === 0, 'No snapshot reads while dragging')
    assert(await page.locator('.tricks-live-clock').textContent() === before, 'Board remains at committed time while dragging')
    const target = Number(await slider.inputValue())
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('[data-tricks-replay-root]')?.getAttribute('aria-busy') === 'false')
    assert(snapshotReads === 1, 'One read at pointer release')
    const checkpoint = manifest.checkpoints[target]
    const state = await json(`http://localhost:3005/api/server/tricks/replay/261009/snapshot?checkpoint=${target}`)
    assert(state.snapshot_at === checkpoint.at, 'Selected checkpoint')
    const seek = async (mode, index) => {
        const select = page.getByRole('combobox', {name: 'リプレイ粒度'})
        if (await select.inputValue() !== mode) {
            await select.selectOption(mode)
            await page.waitForFunction(() => document.querySelector('[data-tricks-replay-root]')?.getAttribute('aria-busy') === 'false')
        }
        const response = page.waitForResponse(response => response.url().includes(`/snapshot?${mode}=${index}`))
        await slider.evaluate((el, index) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,index); el.dispatchEvent(new Event('input',{bubbles:true})) }, index)
        await slider.dispatchEvent('pointerup')
        await response
        await page.waitForFunction(() => document.querySelector('[data-tricks-replay-root]')?.getAttribute('aria-busy') === 'false')
        await page.waitForTimeout(350)
    }
    await seek('checkpoint', 192)
    const final = await json('http://localhost:3005/api/server/tricks/replay/261009/snapshot?checkpoint=192')
    assert(final.collected_count === 143 && final.post_total === 429 && final.draw_total === 963, 'Final totals')
    const user = final.players.find(user => final.hands_by_player[user.name]?.length === Math.max(...Object.values(final.hands_by_player).map(hand => hand.length)))
    await page.locator(`[data-tricks-player="${user.name}"]`).click()
    assert(await page.locator('[data-tricks-player-tooltip]').count() === 1, 'Player tooltip')
    assert(await page.locator('[data-tricks-replay-card-type="hand"]').count() === final.hands_by_player[user.name].length, 'Historical hand')
    const handOrder = await page.locator('[data-tricks-replay-card-type="hand"]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-tricks-replay-card'))))
    assert(JSON.stringify(handOrder) === JSON.stringify(final.hands_by_player[user.name].map(card => card.event_card_id)), 'Historical hand order')
    const mini = page.locator('[data-tricks-mini-holder-cards] button').first()
    await mini.click()
    await page.locator('.tricks-replay-detail-panel').waitFor()
    assert(scoreReads === 0, 'Mini rankings use replay snapshot, not current scores API')
    await page.getByRole('button', {name:'閉じる',exact:true}).click()
    assert(await page.locator('[data-tricks-replay-actions]').count() === 0, 'Board operation box removed')
    const takeIndex = manifest.timeline.findIndex(frame => frame.event === 'take')
    await seek('frame', takeIndex - 1)
    const preTake = await json(`http://localhost:3005/api/server/tricks/replay/261009/snapshot?frame=${takeIndex - 1}`)
    const afterTake = await json(`http://localhost:3005/api/server/tricks/replay/261009/snapshot?frame=${takeIndex}`)
    const taken = afterTake.field.find(card => !preTake.field.some(before => before.event_card_id === card.event_card_id))
    await page.locator(`[data-tricks-player="${taken.taker}"]`).click()
    const takenSelector = `[data-tricks-replay-card="${taken.event_card_id}"]`
    await page.locator(takenSelector).evaluate(el => { el.dataset.identity = 'retained' })
    await seek('frame', takeIndex)
    assert(await page.locator(takenSelector).getAttribute('data-identity') === 'retained', 'Same card DOM retained hand-to-field')
    assert(await page.locator(`${takenSelector} button`).evaluate(el => getComputedStyle(el).transitionDuration.split(',')[0].trim()) === '0.24s', '240ms smooth field movement')
    await page.locator(`${takenSelector} button`).click()
    await page.locator('.tricks-replay-detail-panel').waitFor()
    await page.getByRole('button', {name:'閉じる',exact:true}).click()
    await page.setViewportSize({width: 1024, height: 1000})
    await page.getByRole('button', {name:'観戦モード',exact:true}).click()
    await page.waitForTimeout(400)
    assert(await page.locator('[data-tricks-replay-seekbar]').isVisible(), 'Fixed seek bar')
    assert(await page.locator('canvas').count() === 2, 'Two canvases')
    const liveBefore = liveReads
    await page.waitForTimeout(6500)
    assert(liveReads === liveBefore, 'Live polling stopped')
    assert(writes === 0, 'No board mutations')
    await page.screenshot({path:'next/pages/limited/tricks/output/playwright/tricks-replay-1024.png'})
    await page.setViewportSize({width:390,height:844})
    assert(await slider.isVisible(), 'Mobile seek bar visible')
    const tooltipBox = await page.locator('[data-tricks-replay-time]').boundingBox()
    assert(tooltipBox.x >= 0 && tooltipBox.x + tooltipBox.width <= 390, 'Mobile tooltip remains inside viewport')
    await page.setViewportSize({width:1440,height:1000})
    await seek('checkpoint', 76)
    await page.screenshot({path:'next/pages/limited/tricks/output/playwright/tricks-replay-desktop.png'})
    await page.getByRole('button', {name:'リプレイを終了',exact:true}).click()
    await page.getByTestId('tricks-collected-results').waitFor()
    assert(await page.locator('[data-tricks-replay-root]').count() === 0, 'Exit replay')
    page.off('request',listener)
    return {checks:21, checkpoints:manifest.checkpoints.length, timeline:manifest.timeline.length, snapshotReads,writes,scoreReads,liveReads}
}
