# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages/limited/tricks/tests/tricks.spec.cjs >> limited tricks phase 6 >> subsidy countdown is shown as soon as an eligible player appears
- Location: pages/limited/tricks/tests/tricks.spec.cjs:160:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/limited/tricks", waiting until "load"

```

# Test source

```ts
  79  |         }
  80  |         let state = uiState()
  81  |         await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
  82  |             user: {userId, role: 0},
  83  |             expires: "2099-01-01T00:00:00.000Z",
  84  |         }}))
  85  |         await page.route("**/api/users", async (route) => route.fulfill({json: []}))
  86  |         await page.route("**/api/server/tricks/**", async (route) => {
  87  |             if (new URL(route.request().url()).pathname.endsWith("/join")) {
  88  |                 state = uiState({me: player, players: [player]})
  89  |                 return route.fulfill({json: {player}})
  90  |             }
  91  |             return route.fulfill({json: state})
  92  |         })
  93  | 
  94  |         await page.goto("/limited/tricks")
  95  |         await expect(page.getByText("第19回期間限定ランキングに参加する")).toBeVisible()
  96  |         await expect(page.getByRole("button", {name: "参加する", exact: true})).toBeEnabled()
  97  |         await expect(page.getByRole("button", {name: "参加", exact: true})).toHaveCount(0)
  98  |         await page.getByRole("button", {name: "参加する", exact: true}).click()
  99  |         await expect(page.getByRole("dialog")).toContainText("期間限定ランキングは、みんなが考えたルール")
  100 |         await expect(page.getByRole("dialog").getByRole("button", {name: "閉じる"})).toBeVisible()
  101 |     })
  102 | 
  103 |     test("participant HUD, hand controls, guide, and focus layers follow the UI rules", async ({page}) => {
  104 |         const userId = "pw_participant_ui"
  105 |         const player = {
  106 |             name: userId,
  107 |             draw_points: 20,
  108 |             rank_points: 7,
  109 |             confirmed_rank_points: 5,
  110 |             provisional_rank_points: 2,
  111 |             total_rank_points: 7,
  112 |             card_count: 1,
  113 |             take_level: 0,
  114 |             take_cost: 2,
  115 |             collected_card_count: 2,
  116 |             subsidy_flag: false,
  117 |         }
  118 |         await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
  119 |             user: {userId, role: 0},
  120 |             expires: "2099-01-01T00:00:00.000Z",
  121 |         }}))
  122 |         await page.route("**/api/users", async (route) => route.fulfill({json: []}))
  123 |         await page.route("**/api/server/tricks/**", async (route) => route.fulfill({json: uiState({me: player, players: [player]})}))
  124 | 
  125 |         await page.goto("/limited/tricks")
  126 |         await expect(page.locator("[data-tricks-collected-count]")).toHaveText("回収カード総数 3枚")
  127 |         await expect(page.locator("[data-tricks-player-collected-count]")).toHaveText("回収カード 2枚")
  128 |         await expect(page.getByText(/確定 5/)).toHaveCount(0)
  129 |         await expect(page.locator("[data-tricks-subsidy-remaining]")).toHaveCount(0)
  130 | 
  131 |         const handCard = page.locator(".tricks-dom-card-hand")
  132 |         await page.locator("[data-tricks-hand-toggle]").click()
  133 |         await expect(page.locator("[data-tricks-hand-toggle]")).toHaveText("手札を表示")
  134 |         await page.waitForTimeout(240)
  135 |         const hiddenBox = await handCard.boundingBox()
  136 |         expect(hiddenBox.y).toBeGreaterThanOrEqual(page.viewportSize().height)
  137 |         await page.locator("[data-tricks-hand-toggle]").click()
  138 |         await expect(page.locator("[data-tricks-hand-toggle]")).toHaveText("手札非表示")
  139 |         await page.waitForTimeout(240)
  140 |         const shownBox = await handCard.boundingBox()
  141 |         expect(shownBox.y).toBeLessThan(page.viewportSize().height)
  142 | 
  143 |         await page.locator("[data-tricks-how-to-play]").click()
  144 |         await expect(page.getByRole("dialog")).toContainText("1. まずはドローボタン")
  145 |         await page.getByRole("dialog").getByRole("button", {name: "閉じる"}).click()
  146 | 
  147 |         await handCard.click()
  148 |         await expect(page.locator('[data-tricks-card-backdrop="hand"]')).toBeVisible()
  149 |         await expect(page.locator("[data-tricks-focus-backdrop]")).toBeVisible()
  150 |         await expect(page.locator("[data-tricks-game-layer]")).toHaveCSS("z-index", "30")
  151 |         await expect(page.locator(".tricks-dom-card-hand.is-selected")).toHaveCSS("z-index", "310")
  152 |         await page.getByRole("button", {name: "キャンセル", exact: true}).click()
  153 | 
  154 |         await page.locator(".tricks-dom-card-field").click()
  155 |         await expect(page.locator('[data-tricks-card-backdrop="field"]')).toBeVisible()
  156 |         await expect(page.locator(".tricks-dom-card-field.is-selected")).toHaveCount(1)
  157 |         await expect(page.locator(".tricks-field-detail-panel")).toBeVisible()
  158 |     })
  159 | 
  160 |     test("subsidy countdown is shown as soon as an eligible player appears", async ({page}) => {
  161 |         const player = {
  162 |             name: "pw_subsidy_ui",
  163 |             draw_points: 3,
  164 |             rank_points: 0,
  165 |             total_rank_points: 0,
  166 |             card_count: 1,
  167 |             take_level: 0,
  168 |             take_cost: 2,
  169 |             collected_card_count: 0,
  170 |             subsidy_flag: true,
  171 |         }
  172 |         await page.route("**/api/auth/session", async (route) => route.fulfill({json: {
  173 |             user: {userId: player.name, role: 0},
  174 |             expires: "2099-01-01T00:00:00.000Z",
  175 |         }}))
  176 |         await page.route("**/api/users", async (route) => route.fulfill({json: []}))
  177 |         await page.route("**/api/server/tricks/**", async (route) => route.fulfill({json: uiState({me: player, players: [player], subsidyFlag: true})}))
  178 | 
> 179 |         await page.goto("/limited/tricks")
      |                    ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  180 |         await expect(page.locator("[data-tricks-subsidy-remaining]")).toContainText("次回給付")
  181 |     })
  182 | 
  183 |     test("fixture API creates 200 isolated cards and keeps player identities separate", async ({request, baseURL}) => {
  184 |         const fixture = await createTricksFixture(request, baseURL)
  185 |         try {
  186 |             expect(fixture.result.counts).toEqual(expect.objectContaining({
  187 |                 events: 1,
  188 |                 decks: 200,
  189 |                 event_cards: 200,
  190 |                 players: 2,
  191 |             }))
  192 |             const [alice, bob] = await Promise.all([
  193 |                 fixture.get(fixture.players[0], "/api/server/tricks/state"),
  194 |                 fixture.get(fixture.players[1], "/api/server/tricks/state"),
  195 |             ])
  196 |             expect(alice.tournament.event_id).toBe(fixture.eventId)
  197 |             expect(alice.me.name).toBe(fixture.players[0])
  198 |             expect(alice.hand).toHaveLength(3)
  199 |             expect(bob.me.name).toBe(fixture.players[1])
  200 |             expect(bob.hand).toHaveLength(0)
  201 |             expect(alice.deck_count).toBe(197)
  202 |         } finally {
  203 |             await fixture.cleanup()
  204 |         }
  205 |     })
  206 | 
  207 |     test("two browser sessions render the same event without sharing private hands", async ({browser, request, baseURL}) => {
  208 |         const fixture = await createTricksFixture(request, baseURL)
  209 |         const contexts = await Promise.all([browser.newContext(), browser.newContext()])
  210 |         try {
  211 |             const pages = await Promise.all(contexts.map((context) => context.newPage()))
  212 |             for (let index = 0; index < pages.length; index += 1) {
  213 |                 const userId = fixture.players[index]
  214 |                 await pages[index].route("**/api/server/tricks/**", async (route) => {
  215 |                     await route.continue({headers: {...route.request().headers(), ...testIdentityHeaders(userId, fixture.eventId)}})
  216 |                 })
  217 |             }
  218 |             await Promise.all(pages.map((page) => page.goto("/limited/tricks")))
  219 |             await Promise.all(pages.map((page) => expect(page.locator("canvas")).toBeVisible()))
  220 |             await expect(pages[0].getByText("P 20 / 手札 3", {exact: true})).toBeVisible()
  221 |             await expect(pages[1].getByText("P 20 / 手札 0", {exact: true})).toBeVisible()
  222 |             await expect(pages[0].getByText("P 20 / 手札 3 / 捨て札 0", {exact: true})).toHaveCount(0)
  223 |             await expect(pages[0].locator("[data-tricks-tournament-info]")).toBeVisible()
  224 |             await expect(pages[0].locator("[data-tricks-header-scroll] > div:last-child > *").first())
  225 |                 .toHaveAttribute("data-tricks-tournament-info", "true")
  226 |             for (const page of pages) {
  227 |                 const canvasCount = await page.locator("canvas").count()
  228 |                 expect(canvasCount).toBeGreaterThanOrEqual(1)
  229 |                 expect(canvasCount).toBeLessThanOrEqual(2)
  230 |             }
  231 |         } finally {
  232 |             await Promise.all(contexts.map((context) => context.close()))
  233 |             await fixture.cleanup()
  234 |         }
  235 |     })
  236 | 
  237 |     test("log panel shows newest entries first and slides behind its left title", async ({page, request, baseURL}) => {
  238 |         const fixture = await createTricksFixture(request, baseURL)
  239 |         await page.route("**/api/auth/session", async (route) => {
  240 |             await route.fulfill({
  241 |                 contentType: "application/json",
  242 |                 body: JSON.stringify({user: {userId: fixture.players[0], role: 0}, expires: "2099-01-01T00:00:00.000Z"}),
  243 |             })
  244 |         })
  245 |         await page.route("**/api/server/tricks/**", async (route) => {
  246 |             await route.continue({
  247 |                 headers: {...route.request().headers(), ...testIdentityHeaders(fixture.players[0], fixture.eventId)},
  248 |             })
  249 |         })
  250 |         try {
  251 |             const beforeTake = await fixture.get(fixture.players[0], "/api/server/tricks/state")
  252 |             const taken = await fixture.post(
  253 |                 fixture.players[0],
  254 |                 `/api/server/tricks/cards/${beforeTake.hand[0].id}/take`,
  255 |             )
  256 |             await fixture.post(fixture.admin, "/api/server/tricks/debug/time/advance", {minutes: 90})
  257 |             await page.goto("/limited/tricks")
  258 |             const state = await fixture.get(fixture.players[0], "/api/server/tricks/state")
  259 |             const visibleEvents = new Set(["join", "take", "record_posted", "record_updated", "subsidy_paid", "collect"])
  260 |             const expectedStateLogIds = [...state.logs]
  261 |                 .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || Number(b.id) - Number(a.id))
  262 |                 .map((log) => String(log.id))
  263 |             expect(state.logs.map((log) => String(log.id))).toEqual(expectedStateLogIds)
  264 |             const expectedLogIds = state.logs.filter((log) => visibleEvents.has(log.event)).map((log) => String(log.id))
  265 |             const logEntries = page.locator("[data-tricks-log-entry]")
  266 |             await expect(logEntries).toHaveCount(expectedLogIds.length)
  267 |             const displayedLogIds = await logEntries.evaluateAll((entries) => {
  268 |                 return entries.map((entry) => entry.getAttribute("data-tricks-log-entry"))
  269 |             })
  270 |             expect(displayedLogIds).toEqual(expectedLogIds)
  271 |             const trashMessage = `${taken.card.title}がトラッシュされました`
  272 |             const displayedLogTexts = await page.locator("[data-tricks-log-entry]").allTextContents()
  273 |             expect(displayedLogTexts.some((text) => text.endsWith(` - ${trashMessage}`))).toBe(true)
  274 | 
  275 |             const wrapper = page.locator("[data-tricks-log-wrapper]")
  276 |             const region = page.locator("[data-tricks-log-region]")
  277 |             const toggle = page.locator("[data-tricks-log-toggle]")
  278 |             await expect(wrapper).toHaveCSS("position", "fixed")
  279 |             await expect(region).toHaveCSS("width", "400px")
```