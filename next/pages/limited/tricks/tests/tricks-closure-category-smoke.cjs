async (page) => {
    await page.unroute('**/api/**')
    const response = await page.request.get('http://localhost:3005/api/users')
    const users = await response.json()
    const user = users.find(user => typeof user.userId === 'string' && user.userId.startsWith('codex_')) || users.find(user => typeof user.userId === 'string' && user.userId.length)
    if (!user) throw new Error('public user fixture missing')
    await page.goto(`http://localhost:3005/user/${encodeURIComponent(user.userId)}/0/261009/2026`)
    const filter = page.locator('#select-rule')
    await filter.waitFor()
    if (!((await filter.textContent()) || '').includes('第19回期間限定ランキング')) throw new Error('category label missing')
    await filter.click()
    const option = page.getByRole('option', {name: '第19回期間限定ランキング', exact: true})
    await option.waitFor()
    if (!(await option.getAttribute('href')).includes('/261009/2026')) throw new Error('category link missing')
    return {checks: 2, categoryLabel: '第19回期間限定ランキング'}
}
