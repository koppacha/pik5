async (page) => {
    await page.unrouteAll()
    await page.goto('http://localhost:3005/limited/tricks')
    await page.getByRole('button', {name:'リプレイモード',exact:true}).click()
    await page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    await page.getByRole('slider', {name:'リプレイ時点'}).focus()
    await page.getByRole('slider', {name:'リプレイ時点'}).press('End')
    await page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    const raw = await (await page.request.get('http://localhost:3005/api/server/tricks/replay/261009/snapshot?checkpoint=192')).json()
    const state = raw.data ?? raw
    const card = state.holder_cards.find(card => card.rankings.some(row => row.img_url))
    await page.getByRole('button', {name:`#${card.stage_id} ${card.title}（${card.rule_name}）`,exact:true}).first().click()
    await page.locator('.tricks-replay-detail-panel svg[data-icon="image"]').first().click()
    const image = page.getByRole('dialog').locator('img')
    await image.waitFor()
    await page.waitForFunction(() => { const img=document.querySelector('[role="dialog"] img'); return img?.complete && img.naturalWidth>0 })
    const result = await image.evaluate(img => ({loaded: img.naturalWidth>0, existingPublicOrigin: new URL(img.src).origin === 'https://pik5.net'}))
    await page.getByRole('dialog').click({position:{x:4,y:4}})
    await page.getByRole('button',{name:'閉じる',exact:true}).click()
    await page.getByRole('button',{name:'リプレイを終了',exact:true}).click()
    return result
}
