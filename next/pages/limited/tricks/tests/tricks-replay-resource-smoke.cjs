async (page) => {
    const assert = (value, message) => { if (!value) throw new Error(message) }
    await page.unrouteAll()
    await page.goto('http://localhost:3005/limited/tricks')
    await page.getByRole('button', {name:'リプレイモード',exact:true}).click()
    await page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    const slider = page.getByRole('slider', {name:'リプレイ時点'})
    const response = page.waitForResponse(response => response.url().includes('/snapshot?checkpoint=76'))
    await slider.evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,76); el.dispatchEvent(new Event('input',{bubbles:true})) })
    await slider.dispatchEvent('pointerup')
    await response
    await page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    await page.mouse.move(0,0)
    await page.waitForTimeout(2500)
    const install = await page.evaluate(() => {
        window.__replayCanvasCalls=0
        for (const method of ['clearRect','fillRect','drawImage']) {
            const original=CanvasRenderingContext2D.prototype[method]
            CanvasRenderingContext2D.prototype[method]=function(...args){window.__replayCanvasCalls+=1;return original.apply(this,args)}
        }
        return {canvas:document.querySelectorAll('canvas').length, nodes:document.querySelectorAll('*').length, animations:document.getAnimations().filter(a=>a.playState==='running').length}
    })
    await page.waitForTimeout(3500)
    const idle = await page.evaluate(() => ({calls:window.__replayCanvasCalls, canvas:document.querySelectorAll('canvas').length, nodes:document.querySelectorAll('*').length, sleeping:window.__TRICKS_RENDER_METRICS__?.phaserLoopSleeping, animations:document.getAnimations().filter(a=>a.playState==='running').length}))
    assert(idle.calls === 0 && idle.sleeping, 'Canvas sleeping')
    assert(idle.canvas === install.canvas && idle.nodes === install.nodes, 'No canvas or DOM growth')
    assert(idle.animations === 0, 'No perpetual replay animations')
    const requests=[]
    const listener=request=>{if(request.url().includes('/tricks/replay/')&&request.url().includes('/snapshot?'))requests.push(request.url())}
    page.on('request',listener)
    for(const index of [120,30,76]) {
        await slider.evaluate((el,index)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,index);el.dispatchEvent(new Event('input',{bubbles:true}))},index)
        await slider.dispatchEvent('pointerup')
    }
    await page.waitForTimeout(700)
    assert((await page.locator('[data-tricks-replay-current-time]').textContent()).includes('2026/10/10 15:00:00'), 'Only latest seek response wins')
    page.off('request',listener)
    await page.emulateMedia({reducedMotion:'reduce'})
    assert(await page.locator('[data-tricks-replay-card] button').first().evaluate(el=>getComputedStyle(el).transitionDuration) === '0s', 'Reduced motion')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await page.getByRole('combobox', {name:'リプレイ再生速度'}).selectOption('4')
    await page.getByRole('button', {name:'リプレイを再生',exact:true}).click()
    await page.waitForTimeout(1700)
    await page.getByRole('button', {name:'リプレイを一時停止',exact:true}).click()
    await page.waitForTimeout(700)
    await page.evaluate(()=>{window.__replayCanvasCalls=0})
    const pausedNodes=await page.locator('*').count()
    await page.waitForTimeout(2000)
    assert(await page.evaluate(()=>window.__replayCanvasCalls)===0, 'Canvas sleeps again after autoplay pause')
    assert(await page.locator('*').count()===pausedNodes, 'No DOM growth after autoplay pause')
    let batches=0
    const batchListener=request=>{if(request.url().includes('/snapshots?'))batches++}
    page.on('request',batchListener)
    await page.getByRole('button', {name:'リプレイを再生',exact:true}).click()
    await page.getByRole('link', {name:'ホーム',exact:true}).click()
    await page.waitForURL('http://localhost:3005/')
    await page.waitForTimeout(500)
    assert(await page.locator('canvas').count() === 0, 'Canvases destroyed on navigation')
    const batchesAtExit=batches
    await page.waitForTimeout(1500)
    assert(batches===batchesAtExit, 'Autoplay timer and requests stop on navigation')
    page.off('request',batchListener)
    const borders=await page.evaluate(()=>window.__TRICKS_BORDER_METRICS__)
    assert(!borders || borders.observed===0, 'Border observers released')
    return {install,idle,rapidSeekRequests:requests.length,canvasAfterNavigation:0,borders}
}
