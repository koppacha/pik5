async (page) => {
    const assert=(value,message)=>{if(!value)throw new Error(message)}
    await page.unrouteAll()
    await page.setViewportSize({width:1440,height:1000})
    await page.goto('http://localhost:3005/limited/tricks')
    await page.getByRole('button',{name:'リプレイモード',exact:true}).click()
    const idle=()=>page.locator('[data-tricks-replay-root][aria-busy="false"]').waitFor()
    await idle()
    const raw=await(await page.request.get('http://localhost:3005/api/server/tricks/replay/261009')).json()
    const manifest=raw.data??raw
    const slider=page.getByRole('slider',{name:'リプレイ時点'})
    const seek=async(mode,index)=>{
        const select=page.getByRole('combobox',{name:'リプレイ粒度'})
        if(await select.inputValue()!==mode){await select.selectOption(mode);await idle()}
        await slider.evaluate((el,index)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,index);el.dispatchEvent(new Event('input',{bubbles:true}))},index)
        await slider.dispatchEvent('pointerup')
        await idle()
        await page.waitForTimeout(300)
    }
    assert(await page.locator('[data-tricks-replay-actions]').count()===0,'Unnecessary operation box removed')
    const checkedLogs=[]
    for(const event of ['join','take','record_posted','collect','subsidy_paid','rule_changed']){
        const index=manifest.timeline.findIndex(frame=>frame.event===event&&frame.log)
        assert(index>=0,`Timeline has ${event}`)
        await seek('frame',index)
        const frame=manifest.timeline[index]
        const expected=await page.locator(`[data-tricks-log-entry="${frame.log_id}"]`).textContent()
        const actual=await page.locator('[data-tricks-replay-log]').textContent()
        assert(actual===expected,`Seek log matches HUD: ${event}`)
        assert(!actual.includes('/ ログ#'),'No artificial log number suffix')
        checkedLogs.push(event)
    }
    await seek('checkpoint',76)
    const rawState=await(await page.request.get('http://localhost:3005/api/server/tricks/replay/261009/snapshot?checkpoint=76')).json()
    const state=rawState.data??rawState
    const unposted=state.field.filter(card=>card.participant_count===0)
    assert(unposted.length>0,'Fixture has unposted cards')
    let rewardChecks=0
    for(const card of state.field){
        const el=page.locator(`[data-tricks-replay-card="${card.event_card_id}"] button`)
        if(!(await el.count()))continue
        const shown=Number(await el.locator('.tricks-dom-stack-value').textContent())
        const groups=Math.floor(card.stack_count/3)
        const bonus=({2:groups+1,3:groups+4,4:2*groups+7,5:3*groups+15})[card.rarity]||0
        const expected=card.stack_count+bonus+card.paid_points_total+card.provisional_pot_points
        assert(shown===expected&&shown>0,'Field fund equals stack + bonus + payments + pot')
        if(!card.participant_count)assert(card.provisional_total_reward===0,'Unposted allocation stays zero')
        rewardChecks++
    }
    const visible=page.locator('[data-tricks-replay-card-type="field"] button')
    const anchors=await visible.evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.closest('[data-tricks-replay-card]').dataset.tricksReplayCard,x:r.x,y:r.y,width:r.width,height:r.height}}).filter(r=>r.y>=174&&r.y<700))
    const positions=[]
    for(const side of ['right','left']){
        const anchor=anchors.find(r=>(r.x+r.width/2>720?'left':'right')===side)
        assert(anchor,`Visible card on ${side}`)
        await page.locator(`[data-tricks-replay-card="${anchor.id}"] button`).click()
        const modal=page.locator('.tricks-replay-detail-panel')
        const bounds=await modal.boundingBox()
        const expectedX=side==='left'?Math.max(24,anchor.x-28-560):anchor.x+anchor.width+28
        const expectedY=Math.max(116,Math.min(anchor.y,1000-360))
        assert(Math.abs(bounds.x-expectedX)<1&&Math.abs(bounds.y-expectedY)<1,'Ranking position uses normal-mode helper')
        assert(bounds.y+bounds.height<=911,'Ranking remains above replay bar')
        positions.push({side,x:Math.round(bounds.x),y:Math.round(bounds.y)})
        if(side==='right')await page.screenshot({path:'/Users/main/IdeaProjects/pik5/next/pages/limited/tricks/output/playwright/tricks-replay-normal-ranking-position.png'})
        await page.getByRole('button',{name:'閉じる',exact:true}).click()
    }
    const mini=page.locator('[data-tricks-mini-holder-cards] button').first()
    const miniAnchor=await mini.boundingBox()
    await mini.click()
    const miniModal=await page.locator('.tricks-replay-detail-panel').boundingBox()
    assert(Math.abs(miniModal.x-Math.max(16,Math.min(miniAnchor.x,1440-576)))<1&&Math.abs(miniModal.y-(miniAnchor.y+miniAnchor.height+4))<1,'Mini ranking uses normal-mode position')
    await page.getByRole('button',{name:'閉じる',exact:true}).click()
    await page.getByRole('button',{name:'リプレイを終了',exact:true}).click()
    return {checkedLogs,rewardChecks,unpostedCards:unposted.length,positions,operationBoxRemoved:true}
}
