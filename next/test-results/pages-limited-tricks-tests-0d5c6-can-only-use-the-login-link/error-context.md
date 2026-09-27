# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pages/limited/tricks/tests/tricks.spec.cjs >> limited tricks phase 6 >> unauthenticated visitors can only use the login link
- Location: pages/limited/tricks/tests/tricks.spec.cjs:52:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/limited/tricks", waiting until "load"

```

# Test source

```ts
  1   | const {expect, test} = require("@playwright/test")
  2   | const {createTricksFixture, testIdentityHeaders} = require("./tricks-fixture")
  3   | 
  4   | function uiState({me = null, players = [], subsidyFlag = false} = {}) {
  5   |     const playerList = players.map((player) => ({...player, subsidy_flag: subsidyFlag || player.subsidy_flag}))
  6   | 
  7   |     return {
  8   |         tournament: {
  9   |             event_id: 990401,
  10  |             title: "UI確認大会",
  11  |             start_at: "2026-09-15T10:00:00+09:00",
  12  |             end_at: "2026-09-15T23:00:00+09:00",
  13  |             state: "active",
  14  |             available: true,
  15  |             debug: false,
  16  |             test_mode: false,
  17  |         },
  18  |         server_now: "2026-09-15T12:00:00+09:00",
  19  |         me,
  20  |         players: playerList,
  21  |         hand: me ? [{
  22  |             id: 201,
  23  |             stage_id: 7201,
  24  |             title: "手札確認カード",
  25  |             rule_name: "テストルール",
  26  |             text: "手札表示確認用",
  27  |             difficulty: 1,
  28  |             rarity: 1,
  29  |         }] : [],
  30  |         field: [{
  31  |             id: 202,
  32  |             event_card_id: 1202,
  33  |             stage_id: 7202,
  34  |             title: "場札確認カード",
  35  |             rule_name: "テストルール",
  36  |             text: "場札表示確認用",
  37  |             difficulty: 1,
  38  |             rarity: 1,
  39  |             stack_count: 2,
  40  |             limit_at: "2026-09-15T13:00:00+09:00",
  41  |             my_can_post: Boolean(me),
  42  |             my_can_extend: Boolean(me),
  43  |         }],
  44  |         deck_count: 198,
  45  |         trash_count: 0,
  46  |         collected_count: 3,
  47  |         logs: [],
  48  |     }
  49  | }
  50  | 
  51  | test.describe("limited tricks phase 6", () => {
  52  |     test("unauthenticated visitors can only use the login link", async ({page}) => {
  53  |         await page.route("**/api/auth/session", async (route) => route.fulfill({json: {}}))
  54  |         await page.route("**/api/users", async (route) => route.fulfill({json: []}))
  55  |         await page.route("**/api/server/tricks/state", async (route) => route.fulfill({json: uiState()}))
> 56  |         await page.goto("/limited/tricks")
      |                    ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  57  |         await expect(page.getByText("このイベントに参加するにはログインが必要です")).toBeVisible()
  58  |         await expect(page.getByRole("link", {name: "ログイン", exact: true})).toHaveAttribute("href", "/auth/login")
  59  |         await expect(page.locator("[data-tricks-access-backdrop]")).toBeVisible()
  60  |         await expect(page.getByRole("button", {name: "ドロー", exact: true})).toBeDisabled()
  61  |         await expect(page.getByText("大会へ参加してください", {exact: true})).toHaveCount(0)
  62  | 
  63  |         const fieldBox = await page.locator(".tricks-dom-card-field").boundingBox()
  64  |         await page.mouse.click(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2)
  65  |         await expect(page.locator(".tricks-field-detail-panel")).toHaveCount(0)
  66  |     })
  67  | 
  68  |     test("logged-in non-participants join from the center gate and see the guide", async ({page}) => {
  69  |         const userId = "pw_join_ui"
  70  |         const player = {
  71  |             name: userId,
  72  |             draw_points: 5,
  73  |             rank_points: 0,
  74  |             total_rank_points: 0,
  75  |             card_count: 0,
  76  |             take_level: 0,
  77  |             take_cost: 2,
  78  |             collected_card_count: 0,
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
```